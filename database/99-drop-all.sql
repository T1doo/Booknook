-- ============================================================================
--  BookNook · 一键销毁 (仅用于重置实验环境!)
-- ============================================================================

BEGIN;

-- 视图
DROP VIEW IF EXISTS v_book_sales_summary  CASCADE;
DROP VIEW IF EXISTS v_monthly_finance     CASCADE;
DROP VIEW IF EXISTS v_daily_sales_trend   CASCADE;
DROP VIEW IF EXISTS v_low_stock_books     CASCADE;
DROP VIEW IF EXISTS v_user_activity       CASCADE;
DROP VIEW IF EXISTS v_purchase_pipeline   CASCADE;

-- 表 (CASCADE 自动清理外键 / 触发器)
DROP TABLE IF EXISTS public.operation_logs       CASCADE;
DROP TABLE IF EXISTS public.inventory_alerts     CASCADE;
DROP TABLE IF EXISTS public.transactions         CASCADE;
DROP TABLE IF EXISTS public.sale_order_items     CASCADE;
DROP TABLE IF EXISTS public.sale_orders          CASCADE;
DROP TABLE IF EXISTS public.purchase_order_items CASCADE;
DROP TABLE IF EXISTS public.purchase_orders      CASCADE;
DROP TABLE IF EXISTS public.books                CASCADE;
DROP TABLE IF EXISTS public.i18n_dict            CASCADE;
DROP TABLE IF EXISTS public.users                CASCADE;

-- 枚举
DROP TYPE IF EXISTS user_role        CASCADE;
DROP TYPE IF EXISTS gender_type      CASCADE;
DROP TYPE IF EXISTS purchase_status  CASCADE;
DROP TYPE IF EXISTS transaction_type CASCADE;

-- 函数
DROP FUNCTION IF EXISTS gen_order_no(TEXT)                  CASCADE;
DROP FUNCTION IF EXISTS fn_set_updated_at()                 CASCADE;
DROP FUNCTION IF EXISTS fn_sales_after_insert()             CASCADE;
DROP FUNCTION IF EXISTS fn_sale_order_after_insert()        CASCADE;
DROP FUNCTION IF EXISTS fn_purchase_status_change()         CASCADE;
DROP FUNCTION IF EXISTS fn_books_low_stock_check(BIGINT)    CASCADE;

COMMIT;
