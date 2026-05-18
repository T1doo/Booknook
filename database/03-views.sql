-- ============================================================================
--  BookNook · 报表用视图
--  说明: 为 Dashboard / 报表导出提供聚合查询的视图层
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 视图 1: 每本书的销售汇总 (供 Top10 畅销书图表)
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS v_book_sales_summary CASCADE;
CREATE VIEW v_book_sales_summary AS
SELECT
    b.id                                   AS book_id,
    b.isbn,
    b.title,
    b.author,
    b.publisher,
    b.category,
    b.retail_price,
    b.stock,
    COALESCE(SUM(soi.quantity), 0)::INT    AS sold_qty,
    COALESCE(SUM(soi.subtotal), 0)         AS sold_amount,
    COUNT(DISTINCT so.id)                  AS order_count,
    MAX(so.created_at)                     AS last_sold_at
FROM public.books b
LEFT JOIN public.sale_order_items soi ON soi.book_id = b.id
LEFT JOIN public.sale_orders      so  ON so.id      = soi.order_id
GROUP BY b.id;

COMMENT ON VIEW v_book_sales_summary IS 'Dashboard · 每本书的销售汇总';

-- ---------------------------------------------------------------------------
-- 视图 2: 按月聚合的财务 (供月收支对比图)
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS v_monthly_finance CASCADE;
CREATE VIEW v_monthly_finance AS
SELECT
    to_char(created_at, 'YYYY-MM')                                  AS month,
    SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END)          AS income,
    SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END)          AS expense,
    SUM(CASE WHEN type = 'income'  THEN amount ELSE -amount END)    AS net,
    COUNT(*)                                                        AS tx_count
FROM public.transactions
GROUP BY to_char(created_at, 'YYYY-MM')
ORDER BY 1;

COMMENT ON VIEW v_monthly_finance IS 'Dashboard · 月度收支汇总';

-- ---------------------------------------------------------------------------
-- 视图 3: 按日聚合的销售趋势 (近 30 天)
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS v_daily_sales_trend CASCADE;
CREATE VIEW v_daily_sales_trend AS
SELECT
    d::DATE                                            AS day,
    COALESCE(s.order_count,   0)                       AS order_count,
    COALESCE(s.book_count,    0)                       AS book_count,
    COALESCE(s.total_amount,  0)                       AS total_amount
FROM generate_series(
        (CURRENT_DATE - INTERVAL '29 day')::DATE,
        CURRENT_DATE,
        INTERVAL '1 day'
    ) AS d
LEFT JOIN LATERAL (
    SELECT
        COUNT(DISTINCT so.id)             AS order_count,
        COALESCE(SUM(soi.quantity), 0)    AS book_count,
        COALESCE(SUM(so.total_amount), 0) AS total_amount
    FROM public.sale_orders so
    LEFT JOIN public.sale_order_items soi ON soi.order_id = so.id
    WHERE so.created_at::DATE = d::DATE
) s ON TRUE;

COMMENT ON VIEW v_daily_sales_trend IS 'Dashboard · 近 30 天销售趋势';

-- ---------------------------------------------------------------------------
-- 视图 4: 库存预警 (实时低库存清单)
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS v_low_stock_books CASCADE;
CREATE VIEW v_low_stock_books AS
SELECT
    id, isbn, title, author, publisher, category,
    stock, low_stock_threshold,
    (low_stock_threshold - stock) AS shortfall
FROM public.books
WHERE stock <= low_stock_threshold
ORDER BY (low_stock_threshold - stock) DESC, title;

COMMENT ON VIEW v_low_stock_books IS '加分项 · 实时库存预警清单';

-- ---------------------------------------------------------------------------
-- 视图 5: 用户活动 (近 30 天)
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS v_user_activity CASCADE;
CREATE VIEW v_user_activity AS
SELECT
    u.id, u.username, u.real_name, u.role,
    COUNT(DISTINCT po.id)                       AS po_created,
    COUNT(DISTINCT so.id)                       AS so_created,
    COUNT(DISTINCT ol.id)                       AS log_count,
    MAX(GREATEST(po.created_at, so.created_at)) AS last_active
FROM public.users u
LEFT JOIN public.purchase_orders po
       ON po.created_by = u.id AND po.created_at > now() - INTERVAL '30 day'
LEFT JOIN public.sale_orders so
       ON so.created_by = u.id AND so.created_at > now() - INTERVAL '30 day'
LEFT JOIN public.operation_logs ol
       ON ol.user_id    = u.id AND ol.created_at > now() - INTERVAL '30 day'
GROUP BY u.id;

COMMENT ON VIEW v_user_activity IS '加分项 · 近 30 天用户活跃度';

-- ---------------------------------------------------------------------------
-- 视图 6: 进货单待办 (Dashboard 顶部 KPI)
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS v_purchase_pipeline CASCADE;
CREATE VIEW v_purchase_pipeline AS
SELECT
    status,
    COUNT(*)                AS order_count,
    COALESCE(SUM(total_amount), 0) AS total_amount
FROM public.purchase_orders
GROUP BY status;

COMMENT ON VIEW v_purchase_pipeline IS 'Dashboard · 进货单按状态聚合';

COMMIT;
