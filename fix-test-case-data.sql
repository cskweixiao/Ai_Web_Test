-- 查看包含"登入失败"的测试用例
SELECT id, title, steps 
FROM test_cases 
WHERE JSON_EXTRACT(steps, '$') LIKE '%登入失败%' 
   OR steps LIKE '%登入失败%';

-- 如果需要修复特定测试用例的数据结构，可以使用类似这样的SQL：
-- UPDATE test_cases 
-- SET steps = JSON_OBJECT(
--   'steps', '1. 打开登录页面\n2. 输入用户名\n3. 输入密码\n4. 点击登录按钮',
--   'assertions', '1. 登入失败\n2. 显示错误提示'
-- )
-- WHERE id = 你的测试用例ID;

-- 或者如果是从steps字段中移动断言到assertions字段：
-- UPDATE test_cases 
-- SET steps = JSON_SET(
--   steps,
--   '$.steps', '修正后的操作步骤',
--   '$.assertions', '登入失败'
-- )
-- WHERE id = 你的测试用例ID;