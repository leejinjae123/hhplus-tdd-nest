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
            insertOrUpdate: jest.fn(),
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
    it('get user Point', async () => {
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
    it('charge point', async () => {
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

    it('max point limit', async () => {
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
    it('use point', async () => {
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

    it('use point > current point', async () => {
      const userId = 1;
      const amount = 150;
      const currentPoint = 100;
      const mockCurrentUserPoint = { id: userId, point: currentPoint, updateMillis: Date.now() };

      jest.spyOn(userTable, 'selectById').mockResolvedValue(mockCurrentUserPoint);

      await expect(service.usePoint(userId, amount)).rejects.toThrow(ConflictException);
      expect(userTable.selectById).toHaveBeenCalledWith(userId);
      expect(userTable.insertOrUpdate).not.toHaveBeenCalled();
      expect(historyTable.insert).not.toHaveBeenCalled();
    });
  });

  describe('Concurrency control', () => {
    const userId = 1;
    const initialPoint = 100;
    let currentPoint = initialPoint;
    it('userID lock test - charge and use', async () => {

      jest.spyOn(userTable, 'selectById').mockImplementation(async () => ({
        id: userId,
        point: currentPoint,
        updateMillis: Date.now(),
      }));

      jest.spyOn(userTable, 'insertOrUpdate').mockImplementation(async (id, point) => {
        currentPoint = point;
        return {
          id,
          point,
          updateMillis: Date.now(),
        };
      });

      jest.spyOn(historyTable, 'insert').mockResolvedValue({} as any);

      const chargePromise = service.chargePoint(userId, 50);
      const usePromise = service.usePoint(userId, 30);

      const [chargeResult, useResult] = await Promise.all([chargePromise, usePromise]);

      expect(userTable.selectById).toHaveBeenCalledTimes(2);
      expect(userTable.insertOrUpdate).toHaveBeenCalledTimes(2);
      expect(chargeResult.point).toBe(initialPoint + 50);
      expect(useResult.point).toBe(initialPoint + 50 - 30);
      expect(currentPoint).toBe(initialPoint + 50 - 30);
    });
  });
  it('multiple charge requests for the same user ID', async () => {
    const chargePromise1 = service.chargePoint(userId, 50);
    const chargePromise2 = service.chargePoint(userId, 30);
    const chargePromise3 = service.chargePoint(userId, 20);

    const [result1, result2, result3] = await Promise.all([chargePromise1, chargePromise2, chargePromise3]);

    expect(userTable.selectById).toHaveBeenCalledTimes(3);
    expect(userTable.insertOrUpdate).toHaveBeenCalledTimes(3);
    expect(result1.point).toBe(initialPoint + 50);
    expect(result2.point).toBe(initialPoint + 50 + 30);
    expect(result3.point).toBe(initialPoint + 50 + 30 + 20);
    expect(currentPoint).toBe(initialPoint + 50 + 30 + 20);
  });

  it('multiple use requests for the same user ID', async () => {
    const usePromise1 = service.usePoint(userId, 20);
    const usePromise2 = service.usePoint(userId, 30);
    const usePromise3 = service.usePoint(userId, 10);

    const [result1, result2, result3] = await Promise.all([usePromise1, usePromise2, usePromise3]);

    expect(userTable.selectById).toHaveBeenCalledTimes(3);
    expect(userTable.insertOrUpdate).toHaveBeenCalledTimes(3);
    expect(result1.point).toBe(initialPoint - 20);
    expect(result2.point).toBe(initialPoint - 20 - 30);
    expect(result3.point).toBe(initialPoint - 20 - 30 - 10);
    expect(currentPoint).toBe(initialPoint - 20 - 30 - 10);
  });
});
});