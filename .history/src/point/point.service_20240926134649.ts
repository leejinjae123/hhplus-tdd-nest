import { Injectable } from '@nestjs/common';
import { PointHistoryTable } from 'src/database/pointhistory.table';
import { UserPointTable } from 'src/database/userpoint.table';
import { PointHistory, TransactionType, UserPoint } from './point.model';

@Injectable()
export class PointService {
  constructor(
    private readonly userTable: UserPointTable,
    private readonly historyTable: PointHistoryTable,
  ) {}

  async getPoint(userId: number): Promise<UserPoint> {
    // 컨트롤러의 로직을 그대로 반영
    return { id: userId, point: 0, updateMillis: Date.now() };
  }

  async getHistory(userId: number): Promise<PointHistory[]> {
    return this.historyTable.selectAllByUserId(userId);
  }

  async chargePoint(userId: number, amount: number): Promise<UserPoint> {
    const updateMillis = Date.now();
    await this.historyTable.insert(
      userId,
      amount,
      TransactionType.CHARGE,
      updateMillis,
    );
    // 컨트롤러의 로직을 그대로 반영하되, 실제 충전 금액 사용
    return { id: userId, point: amount, updateMillis };
  }

  async usePoint(userId: number, amount: number): Promise<UserPoint> {
    const updateMillis = Date.now();
    await this.historyTable.insert(
      userId,
      -amount,
      TransactionType.USE,
      updateMillis,
    );
    // 컨트롤러의 로직을 그대로 반영하되, 실제 사용 금액 반영
    return { id: userId, point: -amount, updateMillis };
  }
}
