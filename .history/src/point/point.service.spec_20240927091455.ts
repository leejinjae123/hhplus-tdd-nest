// point.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { PointService } from './point.service';
import { PointHistoryTable } from '../database/pointhistory.table';
import { UserPointTable } from '../database/userpoint.table';
import { PointHistory, TransactionType } from './point.model';
import { ConflictException, NotFoundException } from '@nestjs/common';

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
            insertOrUpdate: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: PointHistoryTable,
          useValue: {
            insert: jest.fn(),
            selectAllByUserId: jest.fn().mockResolvedValue([]),
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
    // 포인트 정보가 존재할 경우
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
    // 유저를 찾을 수 없는경우
    it('user not found', async () => {
      const userId = 2;
      jest.spyOn(userTable, 'selectById').mockResolvedValue(null);

      await expect(service.getPoint(userId)).rejects.toThrow(NotFoundException);
      expect(userTable.selectById).toHaveBeenCalledWith(userId);
    });
  });

  describe('getHistory', () => {
    // 포인트 사용내역이 존재할 경우
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

    // 포인트 사용내역이 존재하지 않을 경우
    it('history not exists', async () => {
      const userId = 2;
      jest.spyOn(historyTable, 'selectAllByUserId').mockResolvedValue([]);

      await expect(service.getHistory(userId)).rejects.toThrow(NotFoundException);
      expect(historyTable.selectAllByUserId).toHaveBeenCalledWith(userId);
      console.log('history not exists');
    });
  });
  describe('chargePoint', () => {
    it('should charge point successfully', async () => {
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

    it('should throw an error if charging points would exceed max balance', async () => {
      const userId = 1;
      const amount = 10000;
      const currentPoint = 95000;
      const mockCurrentUserPoint = { id: userId, point: currentPoint, updateMillis: Date.now() };

      jest.spyOn(userTable, 'selectById').mockResolvedValue(mockCurrentUserPoint);

      await expect(service.chargePoint(userId, amount)).rejects.toThrow(ConflictException);

      expect(userTable.insertOrUpdate).not.toHaveBeenCalled();
      expect(historyTable.insert).not.toHaveBeenCalled();
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

      await expect(service.usePoint(userId, amount)).rejects.toThrow('not enough point');
      expect(userTable.selectById).toHaveBeenCalledWith(userId);
      expect(userTable.insertOrUpdate).not.toHaveBeenCalled();
      expect(historyTable.insert).not.toHaveBeenCalled();
    });
  });

  describe('Concurrency control', () => {
    it('should process concurrent requests for the same user sequentially', async () => {
      const userId = 1;
      const initialPoint = 100;
      const mockCurrentUserPoint = { id: userId, point: initialPoint, updateMillis: Date.now() };

      jest.spyOn(userTable, 'selectById').mockResolvedValue(mockCurrentUserPoint);
      jest.spyOn(userTable, 'insertOrUpdate').mockImplementation(async (id, point) => ({
        id,
        point,
        updateMillis: Date.now(),
      }));
      jest.spyOn(historyTable, 'insert').mockResolvedValue({} as any);

      const chargePromise = service.chargePoint(userId, 50);
      const usePromise = service.usePoint(userId, 30);

      await Promise.all([chargePromise, usePromise]);

      expect(userTable.insertOrUpdate).toHaveBeenCalledTimes(2);
      const finalCall = userTable.insertOrUpdate.mock.calls[1];
      expect(finalCall[1]).toBe(initialPoint + 50 - 30);
    });
  });
});