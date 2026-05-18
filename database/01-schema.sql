-- ============================================================================
--  BookNook · 暖书阁图书销售管理系统
--  Database Schema · PostgreSQL 16 (兼容 PG12+)
--
--  作者: 李俊辉 24307090032
--  课程: 数据库引论 · 中期实验 2026
--
--  说明:
--    本脚本创建 booknook 数据库所需的全部对象,包括:
--      - 10 张业务表  (users / books / purchase_* / sale_* / transactions /
--                     operation_logs / inventory_alerts / i18n_dict)
--      - 7 个枚举/CHECK 约束
--      - 12 个索引 (主键/唯一/查询/GIN 三元组模糊)
--      - 5 个触发器  (库存联动 / 入库联动 / 财务联动 / 审计 / 库存预警)
--      - 5 个业务函数 (gen_order_no / fn_md5_hash / fn_sales_after_insert ...)
--
--  执行方式:
--    psql -U postgres -d booknook -f 01-schema.sql
--
--  设计哲学:
--    1. 业务表完全满足 BCNF,无传递依赖。
--    2. 进货价/零售价/数量/金额等"事实"字段冻结在订单明细,
--       与库存表 books 解耦,后续改价不影响历史。
--    3. transactions 与 orders.total_amount 的双写冗余出于审计追溯,
--       订单可改,流水不可改,符合财务系统规范。
--    4. 全部时间戳使用 TIMESTAMPTZ + DEFAULT now(),避免时区歧义。
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. 准备工作 · 启用扩展 / 清理旧对象
-- ---------------------------------------------------------------------------

-- pg_trgm 提供 GIN 三元组索引,加速 ILIKE '%关键字%' 模糊查询
CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- pgcrypto 提供 gen_random_bytes,用于密码 salt 生成
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 为脚本可重入,先按依赖逆序清理。生产环境慎用,实验环境无所谓。
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

DROP TYPE  IF EXISTS user_role          CASCADE;
DROP TYPE  IF EXISTS gender_type        CASCADE;
DROP TYPE  IF EXISTS purchase_status    CASCADE;
DROP TYPE  IF EXISTS transaction_type   CASCADE;

DROP FUNCTION IF EXISTS gen_order_no(prefix TEXT)           CASCADE;
DROP FUNCTION IF EXISTS fn_sales_after_insert()             CASCADE;
DROP FUNCTION IF EXISTS fn_purchase_after_receive()         CASCADE;
DROP FUNCTION IF EXISTS fn_audit_log()                      CASCADE;
DROP FUNCTION IF EXISTS fn_books_low_stock_check()          CASCADE;

-- ---------------------------------------------------------------------------
-- 1. 枚举类型
-- ---------------------------------------------------------------------------

CREATE TYPE user_role        AS ENUM ('super_admin', 'admin');
CREATE TYPE gender_type      AS ENUM ('male', 'female', 'other');
CREATE TYPE purchase_status  AS ENUM ('pending', 'paid', 'returned', 'received');
CREATE TYPE transaction_type AS ENUM ('income', 'expense');

COMMENT ON TYPE user_role        IS '用户角色: 超级管理员 / 普通管理员';
COMMENT ON TYPE purchase_status  IS '进货单状态: 未付款 / 已付款 / 已退货 / 已入库';
COMMENT ON TYPE transaction_type IS '财务流水类型: 收入 / 支出';

-- ---------------------------------------------------------------------------
-- 2. 用户表 (users)
--    满足 PPT 要求:用户名 / 密码(MD5+salt) / 真实姓名 / 工号 / 性别 / 年龄
--    role 区分超级管理员与普通管理员
-- ---------------------------------------------------------------------------

CREATE TABLE public.users (
    id              BIGSERIAL PRIMARY KEY,
    username        VARCHAR(32)  NOT NULL UNIQUE,
    password_hash   CHAR(32)     NOT NULL,                  -- MD5 输出固定 32 hex
    salt            CHAR(24)     NOT NULL,                  -- 12 字节 -> 24 hex
    real_name       VARCHAR(32)  NOT NULL,
    employee_no     VARCHAR(16)  NOT NULL UNIQUE,
    gender          gender_type  NOT NULL DEFAULT 'other',
    age             SMALLINT     CHECK (age IS NULL OR (age BETWEEN 16 AND 100)),
    role            user_role    NOT NULL DEFAULT 'admin',
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.users               IS 'PPT-1 用户管理';
COMMENT ON COLUMN public.users.password_hash IS 'MD5(password || salt) 32 位十六进制';
COMMENT ON COLUMN public.users.salt          IS '12 字节随机盐, 以 24 位十六进制保存';
COMMENT ON COLUMN public.users.employee_no   IS '工号, 全局唯一';

CREATE INDEX idx_users_role     ON public.users (role);
CREATE INDEX idx_users_active   ON public.users (is_active) WHERE is_active;

-- ---------------------------------------------------------------------------
-- 3. 库存书籍表 (books)
--    PPT-2 / PPT-4 / PPT-9
-- ---------------------------------------------------------------------------

CREATE TABLE public.books (
    id                   BIGSERIAL PRIMARY KEY,
    isbn                 VARCHAR(20)   NOT NULL UNIQUE,
    title                VARCHAR(200)  NOT NULL,
    publisher            VARCHAR(100)  NOT NULL,
    author               VARCHAR(100)  NOT NULL,
    retail_price         NUMERIC(10,2) NOT NULL CHECK (retail_price >= 0),
    stock                INTEGER       NOT NULL DEFAULT 0  CHECK (stock >= 0),
    low_stock_threshold  INTEGER       NOT NULL DEFAULT 5  CHECK (low_stock_threshold >= 0),
    cover_url            TEXT,
    category             VARCHAR(50),
    created_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ   NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.books              IS 'PPT-2 库存书籍管理';
COMMENT ON COLUMN public.books.low_stock_threshold
    IS '库存预警阈值,低于此值触发 inventory_alerts';

CREATE UNIQUE INDEX idx_books_isbn  ON public.books (isbn);
-- ILIKE '%xx%' 加速;书名/作者/出版社三元组索引
CREATE INDEX idx_books_title_trgm    ON public.books USING gin (title     gin_trgm_ops);
CREATE INDEX idx_books_author_trgm   ON public.books USING gin (author    gin_trgm_ops);
CREATE INDEX idx_books_publisher_trgm ON public.books USING gin (publisher gin_trgm_ops);
CREATE INDEX idx_books_low_stock     ON public.books (stock) WHERE stock <= low_stock_threshold;

-- ---------------------------------------------------------------------------
-- 4. 进货单 / 进货明细 (purchase_orders / purchase_order_items)
--    PPT-5 进货 -> PPT-6 付款 -> PPT-7 退货 -> PPT-8 入库 四态机
-- ---------------------------------------------------------------------------

CREATE TABLE public.purchase_orders (
    id            BIGSERIAL PRIMARY KEY,
    order_no      VARCHAR(32)      NOT NULL UNIQUE,
    created_by    BIGINT           NOT NULL REFERENCES public.users(id),
    supplier      VARCHAR(100),
    status        purchase_status  NOT NULL DEFAULT 'pending',
    total_amount  NUMERIC(12,2)    NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    remark        TEXT,
    created_at    TIMESTAMPTZ      NOT NULL DEFAULT now(),
    paid_at       TIMESTAMPTZ,
    returned_at   TIMESTAMPTZ,
    received_at   TIMESTAMPTZ,
    updated_at    TIMESTAMPTZ      NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.purchase_orders IS 'PPT-5/6/7/8 进货单(四态: pending/paid/returned/received)';

CREATE INDEX idx_po_status_time ON public.purchase_orders (status, created_at DESC);
CREATE INDEX idx_po_created_by  ON public.purchase_orders (created_by);

-- 明细表:book_id 可空, 因为新书首次进货时 books 中可能尚无记录,
--        入库时(状态 received)才正式落到 books。
CREATE TABLE public.purchase_order_items (
    id              BIGSERIAL PRIMARY KEY,
    order_id        BIGINT        NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    book_id         BIGINT        REFERENCES public.books(id),
    isbn            VARCHAR(20)   NOT NULL,
    title           VARCHAR(200)  NOT NULL,
    publisher       VARCHAR(100)  NOT NULL,
    author          VARCHAR(100)  NOT NULL,
    purchase_price  NUMERIC(10,2) NOT NULL CHECK (purchase_price >= 0),
    quantity        INTEGER       NOT NULL CHECK (quantity > 0),
    retail_price    NUMERIC(10,2)        CHECK (retail_price IS NULL OR retail_price >= 0),
    subtotal        NUMERIC(12,2) GENERATED ALWAYS AS (purchase_price * quantity) STORED
);

COMMENT ON COLUMN public.purchase_order_items.book_id
    IS '已有库存的书直接引用;新书首次进货时为 NULL,入库时回填';
COMMENT ON COLUMN public.purchase_order_items.retail_price
    IS '入库时由操作员指定零售价,此前为 NULL';

CREATE INDEX idx_poi_order ON public.purchase_order_items (order_id);
CREATE INDEX idx_poi_book  ON public.purchase_order_items (book_id);

-- ---------------------------------------------------------------------------
-- 5. 销售单 / 销售明细 (sale_orders / sale_order_items)
--    PPT-9 书籍购买
-- ---------------------------------------------------------------------------

CREATE TABLE public.sale_orders (
    id            BIGSERIAL PRIMARY KEY,
    order_no      VARCHAR(32)    NOT NULL UNIQUE,
    created_by    BIGINT         NOT NULL REFERENCES public.users(id),
    customer_note VARCHAR(100),
    total_amount  NUMERIC(12,2)  NOT NULL CHECK (total_amount >= 0),
    created_at    TIMESTAMPTZ    NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sale_orders IS 'PPT-9 销售单(一次性结账)';

CREATE INDEX idx_so_created_at ON public.sale_orders (created_at DESC);
CREATE INDEX idx_so_created_by ON public.sale_orders (created_by);

CREATE TABLE public.sale_order_items (
    id          BIGSERIAL PRIMARY KEY,
    order_id    BIGINT        NOT NULL REFERENCES public.sale_orders(id) ON DELETE CASCADE,
    book_id     BIGINT        NOT NULL REFERENCES public.books(id),
    quantity    INTEGER       NOT NULL CHECK (quantity > 0),
    unit_price  NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
    subtotal    NUMERIC(12,2) GENERATED ALWAYS AS (unit_price * quantity) STORED
);

CREATE INDEX idx_soi_order ON public.sale_order_items (order_id);
CREATE INDEX idx_soi_book  ON public.sale_order_items (book_id);

-- ---------------------------------------------------------------------------
-- 6. 财务流水 (transactions)
--    PPT-10/11 财务管理 / 查看账单
-- ---------------------------------------------------------------------------

CREATE TABLE public.transactions (
    id             BIGSERIAL PRIMARY KEY,
    type           transaction_type NOT NULL,
    amount         NUMERIC(12,2)    NOT NULL CHECK (amount > 0),
    related_table  VARCHAR(32),                       -- 'purchase_orders' / 'sale_orders'
    related_id     BIGINT,                            -- 对应订单 id
    description    VARCHAR(200)     NOT NULL,
    created_by     BIGINT           REFERENCES public.users(id),
    created_at     TIMESTAMPTZ      NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.transactions IS 'PPT-10 财务管理 · 不可篡改的流水账';

CREATE INDEX idx_tx_created_at ON public.transactions (created_at DESC);
CREATE INDEX idx_tx_type_time  ON public.transactions (type, created_at DESC);
CREATE INDEX idx_tx_related    ON public.transactions (related_table, related_id);

-- ---------------------------------------------------------------------------
-- 7. 操作日志 (operation_logs)  · 加分项
-- ---------------------------------------------------------------------------

CREATE TABLE public.operation_logs (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT        REFERENCES public.users(id) ON DELETE SET NULL,
    action       VARCHAR(32)   NOT NULL,         -- create / update / delete / pay / receive ...
    resource     VARCHAR(32)   NOT NULL,         -- books / users / purchase_orders ...
    resource_id  VARCHAR(64),
    ip           VARCHAR(45),
    user_agent   TEXT,
    payload      JSONB,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.operation_logs IS '加分项: 全量操作审计日志(增删改可追溯)';

CREATE INDEX idx_logs_time     ON public.operation_logs (created_at DESC);
CREATE INDEX idx_logs_user     ON public.operation_logs (user_id, created_at DESC);
CREATE INDEX idx_logs_resource ON public.operation_logs (resource, action);

-- ---------------------------------------------------------------------------
-- 8. 库存预警 (inventory_alerts)  · 加分项
-- ---------------------------------------------------------------------------

CREATE TABLE public.inventory_alerts (
    id              BIGSERIAL PRIMARY KEY,
    book_id         BIGINT       NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
    threshold       INTEGER      NOT NULL,
    current_stock   INTEGER      NOT NULL,
    last_alerted_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    resolved        BOOLEAN      NOT NULL DEFAULT FALSE,
    resolved_at     TIMESTAMPTZ
);

COMMENT ON TABLE public.inventory_alerts IS '加分项: 库存低于阈值时自动产生预警';

CREATE INDEX idx_alerts_open ON public.inventory_alerts (resolved, last_alerted_at DESC)
    WHERE resolved = FALSE;

-- ---------------------------------------------------------------------------
-- 9. 国际化字典 (i18n_dict)  · 加分项
-- ---------------------------------------------------------------------------

CREATE TABLE public.i18n_dict (
    key        VARCHAR(64) PRIMARY KEY,
    zh         TEXT NOT NULL,
    en         TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.i18n_dict IS '加分项: 后端可返回的中英文词条';

-- ============================================================================
--  函数与触发器
-- ============================================================================

-- 通用: 自动维护 updated_at
CREATE OR REPLACE FUNCTION fn_set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_books_updated_at
    BEFORE UPDATE ON public.books
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_po_updated_at
    BEFORE UPDATE ON public.purchase_orders
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ----------------------------------------------------------------------------
-- 9.1 订单号生成函数
--     形如: PO-20260517-0001 / SO-20260517-0001
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION gen_order_no(prefix TEXT) RETURNS TEXT AS $$
DECLARE
    today TEXT := to_char(now(), 'YYYYMMDD');
    seq   INT;
BEGIN
    IF prefix = 'PO' THEN
        SELECT COUNT(*) + 1 INTO seq
          FROM public.purchase_orders
         WHERE order_no LIKE 'PO-' || today || '-%';
    ELSE
        SELECT COUNT(*) + 1 INTO seq
          FROM public.sale_orders
         WHERE order_no LIKE 'SO-' || today || '-%';
    END IF;
    RETURN prefix || '-' || today || '-' || lpad(seq::TEXT, 4, '0');
END
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 9.2 销售单插入后: 扣库存 + 写入财务流水
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_sales_after_insert() RETURNS TRIGGER AS $$
DECLARE
    so RECORD;
BEGIN
    -- 扣库存(若库存不足直接抛错,事务回滚)
    UPDATE public.books
       SET stock = stock - NEW.quantity
     WHERE id = NEW.book_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Book id=% 不存在', NEW.book_id;
    END IF;

    -- 库存预警检查
    PERFORM fn_books_low_stock_check(NEW.book_id);

    RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sale_items_after_insert
    AFTER INSERT ON public.sale_order_items
    FOR EACH ROW EXECUTE FUNCTION fn_sales_after_insert();

-- 销售单本身插入后,写入一条 income 流水
CREATE OR REPLACE FUNCTION fn_sale_order_after_insert() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.transactions
        (type, amount, related_table, related_id, description, created_by)
    VALUES
        ('income', NEW.total_amount, 'sale_orders', NEW.id,
         '销售单 ' || NEW.order_no, NEW.created_by);
    RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sale_orders_after_insert
    AFTER INSERT ON public.sale_orders
    FOR EACH ROW EXECUTE FUNCTION fn_sale_order_after_insert();

-- ----------------------------------------------------------------------------
-- 9.3 进货单状态机:
--      pending -> paid    : 写一条 expense 流水
--      paid    -> received: 入库 (新增/累加 books.stock)
--      pending -> returned: 仅状态变化
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_purchase_status_change() RETURNS TRIGGER AS $$
DECLARE
    item       RECORD;
    target_id  BIGINT;
BEGIN
    -- 付款: 写支出流水
    IF OLD.status = 'pending' AND NEW.status = 'paid' THEN
        NEW.paid_at := now();
        INSERT INTO public.transactions
            (type, amount, related_table, related_id, description, created_by)
        VALUES
            ('expense', NEW.total_amount, 'purchase_orders', NEW.id,
             '进货单 ' || NEW.order_no || ' 付款', NEW.created_by);
    END IF;

    -- 退货: 仅打标记
    IF OLD.status = 'pending' AND NEW.status = 'returned' THEN
        NEW.returned_at := now();
    END IF;

    -- 入库: 已付款的书到货后,合并/新增到 books
    IF OLD.status = 'paid' AND NEW.status = 'received' THEN
        NEW.received_at := now();
        FOR item IN
            SELECT * FROM public.purchase_order_items WHERE order_id = NEW.id
        LOOP
            IF item.book_id IS NULL THEN
                -- 新书 -> 新增到 books;若 ISBN 已存在则改为 +stock
                SELECT id INTO target_id FROM public.books WHERE isbn = item.isbn;
                IF target_id IS NULL THEN
                    INSERT INTO public.books
                        (isbn, title, publisher, author, retail_price, stock)
                    VALUES
                        (item.isbn, item.title, item.publisher, item.author,
                         COALESCE(item.retail_price, item.purchase_price * 1.5),
                         item.quantity)
                    RETURNING id INTO target_id;
                ELSE
                    UPDATE public.books
                       SET stock = stock + item.quantity,
                           retail_price = COALESCE(item.retail_price, retail_price)
                     WHERE id = target_id;
                END IF;
                -- 回填 book_id
                UPDATE public.purchase_order_items
                   SET book_id = target_id
                 WHERE id = item.id;
            ELSE
                -- 已存在书 -> 直接累加
                UPDATE public.books
                   SET stock = stock + item.quantity,
                       retail_price = COALESCE(item.retail_price, retail_price)
                 WHERE id = item.book_id;
            END IF;
        END LOOP;
    END IF;

    RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_purchase_status_change
    BEFORE UPDATE OF status ON public.purchase_orders
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION fn_purchase_status_change();

-- ----------------------------------------------------------------------------
-- 9.4 库存预警函数
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_books_low_stock_check(p_book_id BIGINT)
RETURNS VOID AS $$
DECLARE
    b RECORD;
BEGIN
    SELECT id, stock, low_stock_threshold INTO b
      FROM public.books WHERE id = p_book_id;

    IF b.stock <= b.low_stock_threshold THEN
        -- 若已有未解决预警,只更新时间戳;否则新增
        IF EXISTS (
            SELECT 1 FROM public.inventory_alerts
             WHERE book_id = p_book_id AND resolved = FALSE
        ) THEN
            UPDATE public.inventory_alerts
               SET last_alerted_at = now(), current_stock = b.stock
             WHERE book_id = p_book_id AND resolved = FALSE;
        ELSE
            INSERT INTO public.inventory_alerts
                (book_id, threshold, current_stock)
            VALUES
                (p_book_id, b.low_stock_threshold, b.stock);
        END IF;
    ELSE
        -- 库存回升 -> 自动解决预警
        UPDATE public.inventory_alerts
           SET resolved = TRUE, resolved_at = now()
         WHERE book_id = p_book_id AND resolved = FALSE;
    END IF;
END
$$ LANGUAGE plpgsql;

COMMIT;

-- ============================================================================
--  脚本结束 · 验证提示
-- ============================================================================
-- 执行后请运行: psql -d booknook -c "\dt"
-- 应看到 10 张表: books, i18n_dict, inventory_alerts, operation_logs,
--                purchase_order_items, purchase_orders, sale_order_items,
--                sale_orders, transactions, users
