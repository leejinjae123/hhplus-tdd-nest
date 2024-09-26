// point.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { PointService } from './point.service';
import { PointHistoryTable } from '../database/pointhistory.table';
import { UserPointTable } from '../database/userpoint.table';
import { TransactionType } from './point.model';

describe('PointService', () => {
  let service: PointService;
  let historyTable: PointHistoryTable;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PointService,
        {
          provide: UserPointTable,
          useValue: {},
        },
        {
          provide: PointHistoryTable,
          useValue: {
            insert: jest.fn(),
            selectAllByUserId: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PointService>(PointService);
    historyTable = module.get<PointHistoryTable>(PointHistoryTable);
  });

  it('pass', () => {
    expect(service).toBeDefined();
  });

  describe('getPoint', () => {
    it('get user Point!', async () => {
      const userId = 1;
      const result = await service.getPoint(userId);
      expect(result).toEqual({
        id: userId,
        point: 0,
        updateMillis: expect.any(Number),
      });
    });
  });

  describe('getHistory', () => {
    it('get user point history!', async () => {
      const userId = 1;
      const mockHistory = [{ id: 1, userId, amount: 100, type: TransactionType.CHARGE, timeMillis: Date.now() }];
      jest.spyOn(historyTable, 'selectAllByUserId').mockResolvedValue(mockHistory);

      const result = await service.getHistory(userId);
      expect(result).toEqual(mockHistory);
      expect(historyTable.selectAllByUserId).toHaveBeenCalledWith(userId);
    });
  });

  describe('chargePoint', () => {
    it('charge user Point!', async () => {
      const userId = 1;
      const amount = 100;
      jest.spyOn(historyTable, 'insert').mockResolvedValue({} as any);

      const result = await service.chargePoint(userId, amount);
      expect(result).toEqual({
        id: userId,
        point: amount,
        updateMillis: expect.any(Number),
      });
      expect(historyTable.insert).toHaveBeenCalledWith(
        userId,
        amount,
        TransactionType.CHARGE,
        expect.any(Number),
      );
    });
  });

  describe('usePoint', () => {
    it('use user Point!', async () => {
      const userId = 1;
      const amount = 50;
      jest.spyOn(historyTable, 'insert').mockResolvedValue({} as any);

      const result = await service.usePoint(userId, amount);
      expect(result).toEqual({
        id: userId,
        point: -amount,
        updateMillis: expect.any(Number),
      });
      expect(historyTable.insert).toHaveBeenCalledWith(
        userId,
        -amount,
        TransactionType.USE,
        expect.any(Number),
      );
    });
  });
});