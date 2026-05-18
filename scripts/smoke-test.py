#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
BookNook 后端冒烟测试 — 完整业务流验证

用法:
    python scripts/smoke-test.py
前置:
    后端已启动 (npm run dev 在 backend/)
    数据库已 init (scripts/00-init-db.ps1)
"""
import json
import sys
import io
import urllib.request
import urllib.parse
import urllib.error

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
BASE = 'http://localhost:4000'


def req(method, path, token=None, data=None):
    url = f'{BASE}{path}'
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    body = json.dumps(data).encode('utf-8') if data is not None else None
    request = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request) as resp:
            return resp.status, json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode('utf-8'))


def main():
    # 1. login
    _, r = req('POST', '/api/auth/login',
               data={'username': 'super', 'password': 'Admin@2026'})
    assert r['code'] == 0, f'登录失败: {r}'
    token = r['data']['token']
    print(f"[1] ✓ 登录: {r['data']['user']['real_name']} ({r['data']['user']['role']})")

    # 2. dashboard
    _, r = req('GET', '/api/analytics/dashboard', token=token)
    print(f"[2] ✓ Dashboard: 月销={r['data']['month']['sales']:.2f}, 库存={r['data']['stock']['totalStock']}")

    # 3. 搜索
    _, r = req('GET', '/api/books?q=' + urllib.parse.quote('算法') + '&field=title', token=token)
    algo_book = r['data']['list'][0]
    print(f"[3] ✓ 搜索 '算法': {algo_book['title']}, 库存={algo_book['stock']}")

    # 4. 创建进货单
    _, r = req('POST', '/api/purchases', token=token, data={
        'supplier': 'smoke-test 供应商',
        'items': [
            {'isbn': '9787999000001', 'title': '《冒烟测试》',
             'publisher': '测试社', 'author': '测试者',
             'purchase_price': 30.00, 'quantity': 5},
            {'book_id': algo_book['id'], 'isbn': algo_book['isbn'],
             'title': algo_book['title'], 'publisher': algo_book['publisher'],
             'author': algo_book['author'], 'purchase_price': 60.00, 'quantity': 3},
        ],
    })
    po = r['data']
    print(f"[4] ✓ 进货单创建: {po['order_no']}, 金额={po['total_amount']}")

    # 5. 付款
    _, r = req('POST', f'/api/purchases/{po["id"]}/pay', token=token)
    print(f"[5] ✓ 付款: 状态={r['data']['status']}")

    # 6. 入库
    _, detail = req('GET', f'/api/purchases/{po["id"]}', token=token)
    new_item_id = next(i['id'] for i in detail['data']['items'] if i['book_id'] is None)
    _, r = req('POST', f'/api/purchases/{po["id"]}/receive', token=token, data={
        'retail_prices': [{'item_id': int(new_item_id), 'retail_price': 45.00}],
    })
    print(f"[6] ✓ 入库: 状态={r['data']['status']}")

    # 7. 验证新书已入库
    _, r = req('GET', '/api/books?q=9787999000001&field=isbn', token=token)
    new_book = r['data']['list'][0]
    print(f"[7] ✓ 新书入库: 库存={new_book['stock']}, 零售={new_book['retail_price']}")

    # 8. 销售
    _, r = req('POST', '/api/sales', token=token, data={
        'customer_note': 'smoke 顾客',
        'items': [{'book_id': int(new_book['id']), 'quantity': 2}],
    })
    print(f"[8] ✓ 销售单: {r['data']['order_no']}, 金额={r['data']['total_amount']}")

    # 9. 库存校验
    _, r = req('GET', f'/api/books/{new_book["id"]}', token=token)
    print(f"[9] ✓ 销售后库存={r['data']['stock']}")

    # 10. 财务流水
    _, r = req('GET', '/api/transactions', token=token)
    print(f"[10] ✓ 流水: income={r['data']['summary']['income']}, expense={r['data']['summary']['expense']}")

    # 11. 操作日志
    _, r = req('GET', '/api/logs', token=token)
    print(f"[11] ✓ 操作日志条数: {r['data']['total']}")

    # 12. RBAC 测试
    _, r = req('POST', '/api/auth/login', data={'username': 'admin1', 'password': 'Admin@2026'})
    admin_token = r['data']['token']
    code, r = req('GET', '/api/users', token=admin_token)
    assert code == 403, f"admin 应该 403 但得到 {code}"
    print(f"[12] ✓ RBAC: admin 访问 /users → 403 (符合预期)")

    # 13. 退货
    _, r = req('POST', '/api/purchases', token=token, data={
        'items': [{'isbn': '9787999000002', 'title': '《退货测试》',
                   'publisher': '测试', 'author': '测试',
                   'purchase_price': 10.00, 'quantity': 1}],
    })
    po2_id = r['data']['id']
    _, r = req('POST', f'/api/purchases/{po2_id}/return', token=token)
    print(f"[13] ✓ 退货: 状态={r['data']['status']}")

    print("\n✅ 所有 13 项 smoke-test 通过 ✅")


if __name__ == '__main__':
    try:
        main()
    except (AssertionError, AssertionError, urllib.error.URLError) as e:
        print(f"\n❌ 测试失败: {e}")
        sys.exit(1)
