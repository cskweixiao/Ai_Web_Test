const cheerio = require('cheerio');
const fs = require('fs');

const html = fs.readFileSync('C:/Users/谭恒/Desktop/集配管理（新增）-cby.html', 'utf-8');
const $ = cheerio.load(html);

console.log('=== 查找包含关键备注的元素 ===\n');

const keywords = ['审核通过时', '商品运费拉取失败', '期望回复时效', '确认入单', '库存是否能满足'];

keywords.forEach(keyword => {
  console.log(`\n🔍 搜索关键字: "${keyword}"`);
  let found = false;

  $('*').each((i, elem) => {
    const $elem = $(elem);
    const text = $elem.text();

    if (text.includes(keyword) && elem.tagName !== 'html' && elem.tagName !== 'body') {
      found = true;
      const id = $elem.attr('id');
      const dataLabel = $elem.attr('data-label');
      const style = $elem.attr('style') || '';
      const isHidden = style.includes('display:none') || style.includes('visibility:hidden') || $elem.hasClass('ax_default_hidden');

      console.log(`  找到: <${elem.tagName}>`);
      console.log(`    ID: ${id || '无'}`);
      console.log(`    data-label: ${dataLabel || '无'}`);
      console.log(`    是否隐藏: ${isHidden ? '是' : '否'}`);
      console.log(`    内容片段: ${text.substring(text.indexOf(keyword) - 20, text.indexOf(keyword) + keyword.length + 100)}`);

      // 只显示第一个匹配,避免输出过多
      return false;
    }
  });

  if (!found) {
    console.log(`  ❌ 未找到`);
  }
});
