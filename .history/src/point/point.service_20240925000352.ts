import { Injectable } from '@nestjs/common';

@Injectable()
export class PointService {
  getHello(): string {
    return 'Hello World!';
  }
}
