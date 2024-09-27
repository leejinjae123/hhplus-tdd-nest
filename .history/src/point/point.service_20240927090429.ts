import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PointHistoryTable } from '../database/pointhistory.table';
import { UserPointTable } from '../database/userpoint.table';
import { PointHistory, TransactionType, UserPoint } from './point.model';

@Injectable()
export class PointService {
  // 동시성 제어를 위한 lock 선언
  private locks: Map<number, Promise<void>> = new Map();
  // 유저포인트의 max치를 100000으로 제한하려고 할당한 변수
  private readonly maxBalance = 100000;
  constructor(
    private readonly userTable: UserPointTable,
    private readonly historyTable: PointHistoryTable,
  ) {}

  private async acquireLock(userId: number): Promise<() => void> {
    while (this.locks.has(userId)) {
      await this.locks.get(userId);
    }
    let releaseLock: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    this.locks.set(userId, lockPromise);
    return () => {
      this.locks.delete(userId);
      releaseLock();
    };
  }

  // 특정 유저의 id를 기반으로 포인트를 가져오는 서비스, 유저 아이디가 없으면 exception 발생
  async getPoint(userId: number): Promise<UserPoint> {
    const userPoint = await this.userTable.selectById(userId);
    if (!userPoint) {
      throw new NotFoundException('user not found in user point table');
    }
    return userPoint;
  }
  // 특정 유저의 id를 기반으로 포인트 사용내역 기록를 가져오는 서비스, 포인트 사용내역이 없으면 exception 발생
  async getHistory(userId: number): Promise<PointHistory[]> {
    const history = await this.historyTable.selectAllByUserId(userId);
    if (history.length === 0) {
      throw new NotFoundException('user not found in history table');
    }
    return history;
  }
  // 특정 유저의 id를 기반으로 number의 양만큼 포인트를 충전하는 서비스
  async chargePoint(userId: number, amount: number): Promise<any> {
    const release = await this.acquireLock(userId);
    try {
      const updateMillis = Date.now();
      const currentUserPoint = await this.userTable.selectById(userId);
      const newPoint = currentUserPoint.point + amount;

      if (newPoint > this.maxBalance) {
        throw new ConflictException('max limit point is 100000');
      }

      await this.historyTable.insert(
        userId,
        amount,
        TransactionType.CHARGE,
        updateMillis,
      );

      const updatedUserPoint = await this.userTable.insertOrUpdate(
        userId,
        newPoint,
      );
      return updatedUserPoint;
    } finally {
      release();
    }
  }

  async usePoint(userId: number, amount: number): Promise<any> {
    const release = await this.acquireLock(userId);
    try {
      const currentUserPoint = await this.userTable.selectById(userId);

      if (currentUserPoint.point < amount) {
        throw new Error('not enough point');
      }

      const updateMillis = Date.now();
      const newPoint = currentUserPoint.point - amount;

      await this.historyTable.insert(
        userId,
        -amount,
        TransactionType.USE,
        updateMillis,
      );

      return this.userTable.insertOrUpdate(userId, newPoint);
    } finally {
      release();
    }
  }
}
