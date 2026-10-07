# 모듈 · 카메라 · 모터 구매물품
- 작성일: 2026-09-29
- 예산 : **1,240,111원**

## 1. 구성품과 역할

| 구성품 | 계획상 역할 | 수량 |
| --- | --- | ---: |
| Pololu #4755 | 바퀴를 회전시키는 구동 모터 | 1 |
| Pololu #4753 | 청소포/스펀지를 구동하는 모터 | 1 |
| Cytron MDD10A | 두 DC 모터의 회전 방향과 속도 제어 | 1 |
| Arduino UNO R4 Minima | 모터 제어 및 엔코더 처리용 제어보드 후보 | 1 |
| Mean Well LRS-150-12 | 12V 전원 공급 장치 후보 | 1 |
| Arducam B029202C | 영상 획득용 USB 카메라 후보 | 4 |
| Jetson Orin Nano Super Developer Kit | 카메라 영상 처리용 보드 후보 | 1 |

제어보드와 Jetson의 역할 분담은 구성 제안이며, 통신 방식과 실제 연결은 추후 확정한다. 카메라 4대의 위치·촬영 대상·동시 사용 여부는 제공 자료에 명시되지 않았다.

## 2. 구매 명세

| 품명 | 규격 | 수량 | 단가 | 계획 금액(원) |
| --- | --- | ---: | ---: | ---: |
| Pololu 100:1 37D 12V 64CPR Encoder #4755 | DC 12V, 무부하 100 RPM, 64CPR 엔코더 | 1 | $60.95 | 약 82,671 |
| Pololu 50:1 37D 12V 64CPR Encoder #4753 | DC 12V, 무부하 200 RPM, 64CPR 엔코더 | 1 | 97,600원 | 97,600 |
| Cytron MDD10A | DC 5~30V, 2채널, 채널당 연속 10A, PWM/DIR 입력 | 1 | 39,930원 | 39,930 |
| Arduino UNO R4 Minima | ABX00080, RA4M1, 48MHz, 동작전압 5V | 1 | 26,950원 | 26,950 |
| Mean Well LRS-150-12 | DC 출력 12V, 12.5A, 150W SMPS | 1 | 23,400원 | 23,400 |
| Arducam USB 카메라 B029202C | 8MP(3264×2448), 자동초점, USB 2.0 UVC, 금속 케이스 | 4 | 68,640원 | 274,560 |
| NVIDIA Jetson Orin Nano Super Developer Kit | 8GB LPDDR5, 개발자 키트 | 1 | 695,000원 | 695,000 |
| **합계** | | | | **1,240,111** |

## 3. 구매 및 제조사 링크

1. 바퀴 모터: [Pololu 공식몰 #4755](https://www.pololu.com/product/4755)
2. 청소포/스펀지 모터: [디바이스마트 Pololu 브랜드 목록](https://www.devicemart.co.kr/goods/brand?category_code=00150001&code=1032), [제조사 #4753 사양](https://www.pololu.com/product/4753)
3. 모터 드라이버: [디바이스마트 MDD10A](https://www.devicemart.co.kr/goods/view?no=1280280)
4. 제어보드: [디바이스마트 Arduino UNO R4 Minima](https://www.devicemart.co.kr/goods/view?no=15088714)
5. 전원: [제노몰 LRS-150-12](https://jenomall.com/goods/goods_view.php?goodsNo=1000009309)
6. 카메라: [디바이스마트 상품번호 15946227](https://www.devicemart.co.kr/goods/view?no=15946227)
7. Jetson: [네이버 스마트스토어 상품번호 13503069997](https://smartstore.naver.com/nstechnology/products/13503069997)




## 4. 확인된 정보와 미확인 정보

| 항목 | 2026-09-29 확인 결과 |
| --- | --- |
| #4755 | 제조사 페이지에서 $60.95, 12V, 무부하 100 RPM 확인. 표시 감속비는 100:1이며 실제 감속비는 약 102.08:1이다. |
| #4753 | 제조사 페이지에서 제품 모델, 12V, 무부하 200 RPM 확인. 디바이스마트 97,600원은 제공 자료 기준이다. |
| MDD10A | 판매 페이지에서 2채널, 5~30V, 연속 10A, PWM/DIR 제어 및 VAT 포함 39,930원 확인. |
| Arduino | 판매 페이지 내용을 확인하지 못해 규격·가격은 제공 자료 기준으로 기록. |
| LRS-150-12 | 판매 페이지 내용을 확인하지 못해 규격·가격은 제공 자료 기준으로 기록. |
| 카메라 | 판매 페이지 내용을 확인하지 못함. B029202C 모델·규격·단가와 수량 4대는 첨부 표 기준. |
| Jetson | 판매 페이지 내용을 확인하지 못함. 정확한 키트명·8GB 규격·695,000원은 첨부 표 기준. |

모터 사양에서 100/200 RPM은 무부하 속도이므로 실제 세척 시 목표 속도와 구분한다. 제조사 설명상 64CPR은 모터 축 기준으로 A/B 두 채널의 양쪽 에지를 모두 계산한 값이다. 출력축 회전량 계산에는 감속비와 실제 카운트 방식을 반영한다. [Pololu 엔코더 설명](https://www.pololu.com/product/4755)


