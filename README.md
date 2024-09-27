## 동시성 제어

포인트 사용 요청 & 포인트 충전 요청의 동시성 문제를 해결하기 위해 사용자 ID 기반의 락을 구현해 보았습니다.
이를 통해 동일 사용자에 대한 여러 요청이 동시에 처리될 때 발생할 수 있는 중복에 따른 오류를 해결하였습니다.

### 1. 동시성 제어 테스트
- 동일 사용자에 대한 동시 요청 처리

#### 동시성 제어 테스트 설명

1. mock 데이터로 초기 포인트를 설정합니다
2. 포인트 충전과 사용 요청을 동시에 실행합니다.
3. 결과 검증
   - 각 작업이 순차적으로 처리되었는지 확인
   - 최종 포인트 값이 예상대로 계산되었는지 확인