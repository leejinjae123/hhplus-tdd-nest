// point.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { PointService } from './point.service';
import { PointHistoryTable } from '../database/pointhistory.table';
import { UserPointTable } from '../database/userpoint.table';
import { PointHistory, TransactionType } from './point.model';
import { NotFoundException } from '@nestjs/common';

describe('PointService', () => {
  let service: PointService;
  let userTable: UserPointTable;
  let historyTable: PointHistoryTable;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PointService,
        {
          provide: UserPointTable,
          useValue: {
            selectById: jest.fn(),
            insertOrUpdate: jest.fn(),
          },
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

    service = module.get(PointService);
    userTable = module.get(UserPointTable);
    historyTable = module.get(PointHistoryTable);
  });

  it('defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPoint', () => {
    it('get user Point!', async () => {
      const userId = 1;
      const mockUserPoint = {
        id: userId,
        point: 100,
        updateMillis: Date.now(),
      };
      jest.spyOn(userTable, 'selectById').mockResolvedValue(mockUserPoint);

      const result = await service.getPoint(userId);
      expect(result).toEqual(mockUserPoint);
      expect(userTable.selectById).toHaveBeenCalledWith(userId);
    });

    it('user not found', async () => {
      const userId = 2;
      jest.spyOn(historyTable, 'selectAllByUserId').mockResolvedValue(null);

      await expect(service.getPoint(userId)).rejects.toThrow(NotFoundException);
      expect(historyTable.selectAllByUserId).toHaveBeenCalledWith(userId);
    });
  });

  describe('getHistory', () => {
    it('history exists', async () => {
      const userId = 1;
      const mockHistory: PointHistory[] = [
        { id: 1, userId: 1, type: TransactionType.CHARGE, amount: 100, timeMillis: expect.any(Number) },
        { id: 2, userId: 1, type: TransactionType.USE, amount: 50, timeMillis: expect.any(Number) }
      ];
      jest.spyOn(historyTable, 'selectAllByUserId').mockResolvedValue(mockHistory);

      const result = await service.getHistory(userId);
      expect(historyTable.selectAllByUserId).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockHistory);
      console.log('history exists');
    });

    it('history not exists', async () => {
      const userId = 2;
      jest.spyOn(historyTable, 'selectAllByUserId').mockResolvedValue([]);

      await expect(service.getHistory(userId)).rejects.toThrow(NotFoundException);
      expect(historyTable.selectAllByUserId).toHaveBeenCalledWith(userId);
      console.log('history not exists');
    });
  });
  describe('chargePoint', () => {
    it('should charge user point successfully', async () => {
      const userId = 1;
      const amount = 100;
      const currentPoint = 50;
      const newPoint = currentPoint + amount;
      const mockCurrentUserPoint = { id: userId, point: currentPoint, updateMillis: Date.now() };
      const mockUpdatedUserPoint = { id: userId, point: newPoint, updateMillis: expect.any(Number) };

      jest.spyOn(userTable, 'selectById').mockResolvedValue(mockCurrentUserPoint);
      jest.spyOn(userTable, 'insertOrUpdate').mockResolvedValue(mockUpdatedUserPoint);
      jest.spyOn(historyTable, 'insert').mockResolvedValue({} as any);

      const result = await service.chargePoint(userId, amount);

      expect(result).toEqual(mockUpdatedUserPoint);
      expect(userTable.selectById).toHaveBeenCalledWith(userId);
      expect(userTable.insertOrUpdate).toHaveBeenCalledWith(userId, newPoint);
      expect(historyTable.insert).toHaveBeenCalledWith(
        userId,
        amount,
        TransactionType.CHARGE,
        expect.any(Number),
      );
    });
  });

  describe('usePoint', () => {
    it('should use user point successfully', async () => {
      const userId = 1;
      const amount = 50;
      const currentPoint = 100;
      const newPoint = currentPoint - amount;
      const mockCurrentUserPoint = { id: userId, point: currentPoint, updateMillis: Date.now() };
      const mockUpdatedUserPoint = { id: userId, point: newPoint, updateMillis: expect.any(Number) };

      jest.spyOn(userTable, 'selectById').mockResolvedValue(mockCurrentUserPoint);
      jest.spyOn(userTable, 'insertOrUpdate').mockResolvedValue(mockUpdatedUserPoint);
      jest.spyOn(historyTable, 'insert').mockResolvedValue({} as any);

      const result = await service.usePoint(userId, amount);

      expect(result).toEqual(mockUpdatedUserPoint);
      expect(userTable.selectById).toHaveBeenCalledWith(userId);
      expect(userTable.insertOrUpdate).toHaveBeenCalledWith(userId, newPoint);
      expect(historyTable.insert).toHaveBeenCalledWith(
        userId,
        -amount,
        TransactionType.USE,
        expect.any(Number),
      );
    });

    it('should throw error when insufficient points', async () => {
      const userId = 1;
      const amount = 150;
      const currentPoint = 100;
      const mockCurrentUserPoint = { id: userId, point: currentPoint, updateMillis: Date.now() };

      jest.spyOn(userTable, 'selectById').mockResolvedValue(mockCurrentUserPoint);

      await expect(service.usePoint(userId, amount)).rejects.toThrow('Insufficient points');
      expect(userTable.selectById).toHaveBeenCalledWith(userId);
      expect(userTable.insertOrUpdate).not.toHaveBeenCalled();
      expect(historyTable.insert).not.toHaveBeenCalled();
    });
  });
});