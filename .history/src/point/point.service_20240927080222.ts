import { Injectable, NotFoundException } from '@nestjs/common';
import { PointHistoryTable } from '../database/pointhistory.table';
import { UserPointTable } from '../database/userpoint.table';
import { PointHistory, TransactionType, UserPoint } from './point.model';

@Injectable()
export class PointService {
  constructor(
    private readonly userTable: UserPointTable,
    private readonly historyTable: PointHistoryTable,
  ) {}

  // 특정 유저의 id를 기반으로 포인트를 가져오는 서비스
  async getPoint(userId: number): Promise<UserPoint> {
    return { id: userId, point: 0, updateMillis: Date.now() };
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
  async chargePoint(userId: number, amount: number): Promise<UserPoint> {
    const updateMillis = Date.now();
    await this.historyTable.insert(
      userId,
      amount,
      TransactionType.CHARGE,
      updateMillis,
    );
    return { id: userId, point: amount, updateMillis };
  }

  // 특정 유저의 id를 기반으로 number의 양만큼 포인트를 사용하는 서비스
  async usePoint(userId: number, amount: number): Promise<UserPoint> {
    const updateMillis = Date.now();
    await this.historyTable.insert(
      userId,
      -amount,
      TransactionType.USE,
      updateMillis,
    );
    return { id: userId, point: -amount, updateMillis };
  }
}
