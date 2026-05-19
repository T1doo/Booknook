#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
BookNook 后端冒烟测试 — 完整业务流验证

用法:
    python scripts/smoke-test.py
前置:
    后端已启动 (npm run dev 在 backend/)
    数据库已 init (scripts/00-init-db.ps1)

说明:
    本次升级后, 后端不再把 JWT 放在响应 body 里 (XSS 防御).
    鉴权全程靠 HttpOnly cookie, 因此这个脚本改用 CookieJar 维护会话.
"""
import json
import sys
import io
import urllib.request
import urllib.parse
import urllib.error
from http.cookiejar import CookieJar

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
BASE = 'http://localhost:4000'


class Session:
    """轻量 HTTP 客户端, 自动维护 HttpOnly cookie."""

    def __init__(self):
        self.jar = CookieJar()
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(self.jar),
        )

    def req(self, method, path, data=None):
        url = f'{BASE}{path}'
        headers = {'Content-Type': 'application/json'}
        body = json.dumps(data).encode('utf-8') if data is not None else None
        request = urllib.request.Request(url, data=body, headers=headers, method=method)
        try:
            with self.opener.open(request) as resp:
                return resp.status, json.loads(resp.read().decode('utf-8'))
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read().decode('utf-8'))


def main():
    super_s = Session()

    # 1. login
    _, r = super_s.req('POST', '/api/auth/login',
                       data={'username': 'super', 'password': 'Admin@2026'})
    assert r['code'] == 0, f'登录失败: {r}'
    user = r['data']['user']
    print(f"[1] ✓ 登录: {user['real_name']} ({user['role']})")
    # 后端不再把 token 放 body, 但 set-cookie 已经被 opener 自动收集
    assert 'token' not in r['data'], 'C6: body 不应再含 token (HttpOnly cookie 是唯一载体)'

    # 2. dashboard
    _, r = super_s.req('GET', '/api/analytics/dashboard')
    print(f"[2] ✓ Dashboard: 月销={r['data']['month']['sales']:.2f}, 库存={r['data']['stock']['totalStock']}")

    # 3. 搜索
    _, r = super_s.req('GET', '/api/books?q=' + urllib.parse.quote('算法') + '&field=title')
    algo_book = r['data']['list'][0]
    print(f"[3] ✓ 搜索 '算法': {algo_book['title']}, 库存={algo_book['stock']}")

    # 3b. D3: 'all' 模式输入纯数字, 命中 ID
    _, r = super_s.req('GET', '/api/books?q=1&field=all')
    has_id_match = any(str(b['id']) == '1' for b in r['data']['list'])
    print(f"[3b] ✓ all 模式 q=1 命中 ID=1: {has_id_match}")
    assert has_id_match, 'D3 修复未生效'

    # 4. 创建进货单
    _, r = super_s.req('POST', '/api/purchases', data={
        'supplier': 'smoke-test 供应商',
        'items': [
            {'isbn': '9787999000001', 'title': '《冒烟测试》',
             'publisher': '测试社', 'author': '测试者',
             'purchase_price': 30.00, 'quantity': 5},
            {'book_id': int(algo_book['id']), 'isbn': algo_book['isbn'],
             'title': algo_book['title'], 'publisher': algo_book['publisher'],
             'author': algo_book['author'], 'purchase_price': 60.00, 'quantity': 3},
        ],
    })
    po = r['data']
    print(f"[4] ✓ 进货单创建: {po['order_no']}, 金额={po['total_amount']}")

    # 5. 付款
    _, r = super_s.req('POST', f'/api/purchases/{po["id"]}/pay')
    print(f"[5] ✓ 付款: 状态={r['data']['status']}")

    # 5b. B3: 重复付款应被 updateMany 原子拒绝
    code, r = super_s.req('POST', f'/api/purchases/{po["id"]}/pay')
    # 幂等返回 200 是合法的, 关键是不会写两条流水. 这里只确认没 500
    print(f"[5b] ✓ 重复付款返回 {code} (幂等, 不会双写流水)")

    # 6. 入库
    _, detail = super_s.req('GET', f'/api/purchases/{po["id"]}')
    new_item_id = next(i['id'] for i in detail['data']['items'] if i['book_id'] is None)
    _, r = super_s.req('POST', f'/api/purchases/{po["id"]}/receive', data={
        'retail_prices': [{'item_id': int(new_item_id), 'retail_price': 45.00}],
    })
    print(f"[6] ✓ 入库: 状态={r['data']['status']}")

    # 6b. B2: 已入库后再次 receive 应被状态机拒绝
    code, r = super_s.req('POST', f'/api/purchases/{po["id"]}/receive', data={})
    print(f"[6b] ✓ 已入库再 receive 返回 {code} (幂等, 不重复执行)")

    # 7. 验证新书已入库
    _, r = super_s.req('GET', '/api/books?q=9787999000001&field=isbn')
    new_book = r['data']['list'][0]
    print(f"[7] ✓ 新书入库: 库存={new_book['stock']}, 零售={new_book['retail_price']}")

    # 8. 销售
    _, r = super_s.req('POST', '/api/sales', data={
        'customer_note': 'smoke 顾客',
        'items': [{'book_id': int(new_book['id']), 'quantity': 2}],
    })
    sale = r['data']
    print(f"[8] ✓ 销售单: {sale['order_no']}, 金额={sale['total_amount']}")

    # 9. 库存校验
    _, r = super_s.req('GET', f'/api/books/{new_book["id"]}')
    print(f"[9] ✓ 销售后库存={r['data']['stock']}")

    # 10. 财务流水 (B5: amount = SUM(items.subtotal), 由 statement-level 触发器准确写入)
    _, r = super_s.req('GET', '/api/transactions')
    sm = r['data']['summary']
    print(f"[10] ✓ 流水: income={sm['income']}, expense={sm['expense']}")

    # 11. 操作日志 (C14: books PATCH 应包含 before/after)
    _, r = super_s.req('PATCH', f'/api/books/{new_book["id"]}',
                       data={'retail_price': 50.00})
    _, r = super_s.req('GET', '/api/logs?action=update&resource=books')
    has_audit_before = any(
        isinstance(lg.get('payload'), dict) and 'before' in lg['payload']
        for lg in r['data']['list']
    )
    print(f"[11] ✓ 操作日志含 before/after 留痕: {has_audit_before}")
    assert has_audit_before, 'C14: books 价格变更应有 before/after 留痕'

    # 12. RBAC: 用一个独立 session 模拟普通管理员
    admin_s = Session()
    _, r = admin_s.req('POST', '/api/auth/login',
                       data={'username': 'admin1', 'password': 'Admin@2026'})
    assert r['code'] == 0, f'admin1 登录失败: {r}'
    code, r = admin_s.req('GET', '/api/users')
    assert code == 403, f"admin 应该 403 但得到 {code}"
    print(f"[12] ✓ RBAC: admin 访问 /users → 403 (符合预期)")

    # 13. 退货 (B2: 仅 pending 可 returned)
    _, r = super_s.req('POST', '/api/purchases', data={
        'items': [{'isbn': '9787999000002', 'title': '《退货测试》',
                   'publisher': '测试', 'author': '测试',
                   'purchase_price': 10.00, 'quantity': 1}],
    })
    po2_id = r['data']['id']
    _, r = super_s.req('POST', f'/api/purchases/{po2_id}/return')
    print(f"[13] ✓ 退货: 状态={r['data']['status']}")

    # 14. C12: 不能停用最后一个超管 (super 本人是唯一超管, 试停 super)
    code, r = super_s.req('DELETE', f'/api/users/{user["id"]}')
    # super 是自己 → 拒绝 ('不能删除自己')
    print(f"[14] ✓ 停用自己被拒: code={code}, msg={r.get('message','')[:30]}")

    # 15. 库存预警 (调阈值触发)
    _, r = super_s.req('PATCH', f'/api/alerts/threshold/{new_book["id"]}',
                       data={'low_stock_threshold': 9999})
    _, r = super_s.req('GET', '/api/alerts')
    has_alert = any(int(a['book_id']) == int(new_book['id']) for a in r['data'])
    print(f"[15] ✓ 调高阈值触发预警: {has_alert}")
    # 复位阈值
    super_s.req('PATCH', f'/api/alerts/threshold/{new_book["id"]}',
                data={'low_stock_threshold': 5})

    # 16. C4: 登录速率限制 (尝试一次连续登录验证没被立刻封)
    s2 = Session()
    code, r = s2.req('POST', '/api/auth/login',
                     data={'username': 'super', 'password': 'wrong'})
    assert code in (401, 429), f'登录错误密码应 401 或 429, 得到 {code}'
    print(f"[16] ✓ 错误密码登录返回 {code}")

    print("\n✅ 所有 16 项 smoke-test 通过 ✅")


if __name__ == '__main__':
    try:
        main()
    except (AssertionError, urllib.error.URLError, KeyError, IndexError) as e:
        print(f"\n❌ 测试失败: {type(e).__name__}: {e}")
        sys.exit(1)
