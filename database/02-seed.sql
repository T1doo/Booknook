-- ============================================================================
--  BookNook · 种子数据
--  说明:
--    1. 写入 1 个超级管理员 (PPT 要求"系统完成时便已经存在")
--    2. 写入 2 个普通管理员供演示
--    3. 写入 30 本中外经典图书 (有真实 ISBN / 出版社, 演示时更可信)
--    4. 写入 i18n 词条 (加分项)
--
--  默认账号:
--    super  / Admin@2026   (super_admin, 超级管理员)
--    admin1 / Admin@2026   (admin,        普通管理员)
--    admin2 / Admin@2026   (admin,        普通管理员)
--
--  密码计算:
--    password_hash = md5(password || salt)
--    本脚本中直接调用 PostgreSQL 内建 md5() 函数计算,
--    与 backend utils/md5.ts 中的实现保持完全一致 (二者协议相同)。
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. 用户
--    salt 取 24 位十六进制 (= 12 字节 random),与 backend utils/md5.ts 协议一致
--    密码统一为 Admin@2026
-- ---------------------------------------------------------------------------
TRUNCATE TABLE public.users RESTART IDENTITY CASCADE;

DO $seed_users$
DECLARE
    pwd   TEXT := 'Admin@2026';
    salt1 TEXT := '5f4dcc3b5aa765d61d83270d';
    salt2 TEXT := 'a1b2c3d4e5f6a7b8c9d0e1f2';
    salt3 TEXT := 'deadbeefcafebabe12345678';
BEGIN
    INSERT INTO public.users
        (username, password_hash,        salt,  real_name, employee_no, gender,   age, role) VALUES
        ('super',  md5(pwd || salt1),    salt1, '李俊辉',   'EMP-0001',  'male',    22, 'super_admin'),
        ('admin1', md5(pwd || salt2),    salt2, '王小明',   'EMP-1001',  'male',    28, 'admin'),
        ('admin2', md5(pwd || salt3),    salt3, '林夏夏',   'EMP-1002',  'female',  26, 'admin');
END $seed_users$;

-- ---------------------------------------------------------------------------
-- 2. 库存书籍 (30 本)
--    分类涵盖: 文学 / 计算机 / 历史 / 哲学 / 经济 / 科普 / 童书 / 艺术
-- ---------------------------------------------------------------------------
TRUNCATE TABLE public.books RESTART IDENTITY CASCADE;

INSERT INTO public.books
    (isbn,            title,                          publisher,           author,                   retail_price, stock, low_stock_threshold, category) VALUES
('9787020002207',  '红楼梦',                          '人民文学出版社',     '曹雪芹',                  59.70, 48, 10, '文学'),
('9787100052917',  '西方哲学史',                       '商务印书馆',         '伯特兰·罗素',             88.00, 22,  5, '哲学'),
('9787508692586',  '人类简史',                         '中信出版社',         '尤瓦尔·赫拉利',           68.00, 35,  8, '历史'),
('9787121362248',  '深入理解计算机系统(原书第3版)',     '电子工业出版社',     'Randal E. Bryant',      139.00, 15,  5, '计算机'),
('9787115476494',  '算法导论(原书第3版)',              '人民邮电出版社',     'Thomas H. Cormen',      128.00, 12,  5, '计算机'),
('9787111213826',  '深入浅出 Node.js',                 '机械工业出版社',     '朴灵',                    69.00, 18,  5, '计算机'),
('9787508671772',  '原则',                             '中信出版集团',       '瑞·达利欧',               98.00, 25,  6, '经济'),
('9787544285186',  '百年孤独',                         '南海出版公司',       '加西亚·马尔克斯',         55.00, 30,  8, '文学'),
('9787546372013',  '小王子',                           '云南人民出版社',     '安东尼·德·圣-埃克苏佩里', 32.00, 60, 15, '童书'),
('9787208061644',  '万历十五年',                       '上海人民出版社',     '黄仁宇',                  49.00, 20,  5, '历史'),
('9787540462673',  '活着',                             '湖南文艺出版社',     '余华',                    39.00, 42, 10, '文学'),
('9787544279420',  '解忧杂货店',                       '南海出版公司',       '东野圭吾',                39.50, 28,  8, '文学'),
('9787513313971',  '深度工作',                         '北京时代华文书局',   '卡尔·纽波特',             45.00, 16,  5, '经济'),
('9787550220900',  '人间失格',                         '北京联合出版公司',   '太宰治',                  29.80, 20,  5, '文学'),
('9787508670127',  '未来简史',                         '中信出版集团',       '尤瓦尔·赫拉利',           68.00, 11,  5, '历史'),
('9787121401923',  '设计模式(GOF)',                    '电子工业出版社',     'Erich Gamma',            89.00,  8,  3, '计算机'),
('9787115521477',  'CSS 揭秘',                         '人民邮电出版社',     'Lea Verou',              79.00, 14,  5, '计算机'),
('9787115279460',  '编码:隐匿在计算机软硬件背后的语言','人民邮电出版社',     'Charles Petzold',         99.00,  9,  3, '计算机'),
('9787521753134',  '置身事内',                         '上海人民出版社',     '兰小欢',                  65.00, 30,  8, '经济'),
('9787521700718',  '叫魂',                             '上海三联书店',       '孔飞力',                  58.00, 14,  5, '历史'),
('9787540479480',  '局外人',                           '湖南文艺出版社',     '阿尔贝·加缪',             28.00, 24,  6, '文学'),
('9787544770521',  '苏菲的世界',                       '译林出版社',         '乔斯坦·贾德',             49.80, 18,  5, '哲学'),
('9787508651231',  '思考,快与慢',                      '中信出版社',         '丹尼尔·卡尼曼',           69.00, 17,  5, '科普'),
('9787508653884',  '硅谷钢铁侠',                       '中信出版集团',       '阿什利·万斯',             49.80, 22,  5, '科普'),
('9787550234925',  '艺术的故事(第16版)',               '广西美术出版社',     'E.H. 贡布里希',          280.00,  6,  3, '艺术'),
('9787108048921',  '美的历程',                         '生活·读书·新知三联书店','李泽厚',                42.00, 16,  4, '艺术'),
('9787547052471',  '从一到无穷大',                     '科学出版社',         'G. 伽莫夫',               38.00, 20,  5, '科普'),
('9787121425042',  'Rust 程序设计(第2版)',             '电子工业出版社',     'Jim Blandy',            148.00,  4,  2, '计算机'),
('9787544291101',  '夜晚的潜水艇',                     '北京十月文艺出版社', '陈春成',                  45.00, 35,  8, '文学'),
('9787544743822',  '失踪的孩子',                       '译林出版社',         '埃莱娜·费兰特',           55.00,  3,  3, '文学');

-- ---------------------------------------------------------------------------
-- 3. 国际化词条
-- ---------------------------------------------------------------------------
TRUNCATE TABLE public.i18n_dict;

INSERT INTO public.i18n_dict (key, zh, en) VALUES
('common.welcome',           '欢迎使用暖书阁',               'Welcome to BookNook'),
('common.tagline',           '一家很有温度的图书销售管理系统', 'A bookstore management system with warmth'),
('book.status.in_stock',     '有货',                         'In stock'),
('book.status.low_stock',    '库存告急',                     'Low stock'),
('book.status.out_of_stock', '缺货',                         'Out of stock'),
('purchase.status.pending',  '未付款',                       'Pending'),
('purchase.status.paid',     '已付款',                       'Paid'),
('purchase.status.returned', '已退货',                       'Returned'),
('purchase.status.received', '已入库',                       'Received');

-- ---------------------------------------------------------------------------
-- 4. 演示数据 (1 张已入库的进货单, 2 张销售单, 自动生成对应流水)
--    便于打开 Dashboard 时图表就有数据
-- ---------------------------------------------------------------------------

-- 进货单 1: 模拟完整生命周期 pending -> paid (写支出流水) -> received (入库)
INSERT INTO public.purchase_orders
    (order_no, created_by, supplier, status, total_amount, created_at)
VALUES
    (gen_order_no('PO'), 1, '中信出版社华东分销中心', 'pending',
     816.00, now() - INTERVAL '7 day');

INSERT INTO public.purchase_order_items
    (order_id, book_id, isbn, title, publisher, author, purchase_price, quantity, retail_price)
SELECT 1, b.id, b.isbn, b.title, b.publisher, b.author,
       b.retail_price * 0.6, 20, b.retail_price
FROM public.books b WHERE b.isbn = '9787508692586';

-- 推进到 paid (触发器写入 expense 流水)
UPDATE public.purchase_orders SET status = 'paid'     WHERE id = 1;
-- 推进到 received (触发器自动 +stock 到 books)
UPDATE public.purchase_orders SET status = 'received' WHERE id = 1;

-- 销售单 1
-- total_amount 由子查询动态计算, 与下方 items 的 SUM(unit_price * quantity) 严格一致,
-- 避免硬编码与实际明细不一致导致的财务对账失败 / Dashboard 数字漂移。
INSERT INTO public.sale_orders (order_no, created_by, customer_note, total_amount, created_at)
VALUES (
    gen_order_no('SO'), 2, '老顾客',
    (SELECT COALESCE(SUM(retail_price * 2), 0)
       FROM public.books
      WHERE isbn IN ('9787020002207', '9787544285186')),
    now() - INTERVAL '3 day'
);

INSERT INTO public.sale_order_items (order_id, book_id, quantity, unit_price)
SELECT 1, b.id, 2, b.retail_price FROM public.books b WHERE b.isbn IN ('9787020002207', '9787544285186');

-- 销售单 2
INSERT INTO public.sale_orders (order_no, created_by, customer_note, total_amount, created_at)
VALUES (
    gen_order_no('SO'), 3, NULL,
    (SELECT COALESCE(SUM(retail_price * 1), 0)
       FROM public.books
      WHERE isbn IN ('9787121362248', '9787115521477')),
    now() - INTERVAL '1 day'
);

INSERT INTO public.sale_order_items (order_id, book_id, quantity, unit_price)
SELECT 2, b.id, 1, b.retail_price FROM public.books b WHERE b.isbn IN ('9787121362248', '9787115521477');

COMMIT;

-- 校验
SELECT '用户数 = ' || COUNT(*)::TEXT FROM public.users
UNION ALL SELECT '书籍数 = ' || COUNT(*)::TEXT FROM public.books
UNION ALL SELECT '进货单 = ' || COUNT(*)::TEXT FROM public.purchase_orders
UNION ALL SELECT '销售单 = ' || COUNT(*)::TEXT FROM public.sale_orders
UNION ALL SELECT '流水数 = ' || COUNT(*)::TEXT FROM public.transactions;
