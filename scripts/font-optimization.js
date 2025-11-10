/**
 * 字体优化脚本
 * 批量修改项目中的字体大小和颜色
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

// 修改统计
const stats = {
  filesProcessed: 0,
  totalChanges: 0,
  changesByType: {
    errorMessages: 0,
    warningMessages: 0,
    successMessages: 0,
    helperText: 0,
    grayColorUpgrade: 0,
    otherTextXs: 0
  },
  preservedTextXs: []
};

// 需要保留text-xs的模式
const preservePatterns = [
  /uppercase/i,  // 表格表头
  /badge/i,      // 徽章
  /formatDate/i, // 时间戳
  /tracking-wider/i, // 表格表头
];

// 修改规则
const replacements = [
  // 1. 错误/警告/成功提示 (最高优先级)
  {
    pattern: /className="([^"]*?)text-xs text-red-(\d+)([^"]*)"/g,
    replacement: 'className="$1text-sm text-red-600 font-medium$3"',
    type: 'errorMessages'
  },
  {
    pattern: /className="([^"]*?)text-xs text-yellow-(\d+)([^"]*)"/g,
    replacement: 'className="$1text-sm text-yellow-600$3"',
    type: 'warningMessages'
  },
  {
    pattern: /className="([^"]*?)text-xs text-green-(\d+)([^"]*)"/g,
    replacement: 'className="$1text-sm text-green-600$3"',
    type: 'successMessages'
  },

  // 2. text-gray-400 升级到 text-gray-600 (非图标)
  {
    pattern: /className="([^"]*?)text-xs text-gray-400([^"]*)"/g,
    replacement: 'className="$1text-sm text-gray-600$2"',
    type: 'helperText',
    excludeIfContains: ['icon', 'Icon']
  },
  {
    pattern: /className="([^"]*?)text-xs text-gray-500([^"]*)"/g,
    replacement: 'className="$1text-sm text-gray-700$2"',
    type: 'helperText'
  },

  // 3. 独立的 text-gray-400 升级 (非text-xs的情况)
  {
    pattern: /text-gray-400(?![\w-])/g,
    replacement: 'text-gray-600',
    type: 'grayColorUpgrade',
    onlyInTextContent: true
  },
];

function shouldPreserveTextXs(line) {
  // 检查是否匹配保留模式
  for (const pattern of preservePatterns) {
    if (pattern.test(line)) {
      return true;
    }
  }

  // 检查是否包含特定关键词
  const preserveKeywords = [
    'uppercase', 'tracking-wider', 'font-medium uppercase',
    'badge', 'status', 'label-tag'
  ];

  for (const keyword of preserveKeywords) {
    if (line.includes(keyword) && line.includes('text-xs')) {
      return true;
    }
  }

  return false;
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  let fileChanges = 0;

  const lines = content.split('\n');
  const processedLines = lines.map((line, index) => {
    // 跳过注释行
    if (line.trim().startsWith('//') || line.trim().startsWith('/*') || line.trim().startsWith('*')) {
      return line;
    }

    // 检查是否应该保留text-xs
    if (shouldPreserveTextXs(line)) {
      if (line.includes('text-xs')) {
        stats.preservedTextXs.push({
          file: path.relative(process.cwd(), filePath),
          line: index + 1,
          content: line.trim().substring(0, 80)
        });
      }
      return line;
    }

    let modifiedLine = line;

    // 应用所有替换规则
    for (const rule of replacements) {
      // 检查排除条件
      if (rule.excludeIfContains) {
        let shouldExclude = false;
        for (const excludeWord of rule.excludeIfContains) {
          if (modifiedLine.includes(excludeWord)) {
            shouldExclude = true;
            break;
          }
        }
        if (shouldExclude) continue;
      }

      const beforeReplace = modifiedLine;
      modifiedLine = modifiedLine.replace(rule.pattern, rule.replacement);

      if (beforeReplace !== modifiedLine) {
        fileChanges++;
        stats.changesByType[rule.type]++;
      }
    }

    return modifiedLine;
  });

  content = processedLines.join('\n');

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    stats.filesProcessed++;
    stats.totalChanges += fileChanges;
    console.log(`✓ ${path.relative(process.cwd(), filePath)} - ${fileChanges} 处修改`);
    return true;
  }

  return false;
}

function processDirectory(pattern) {
  console.log(`\n正在处理: ${pattern}\n`);

  const files = glob.sync(pattern);
  console.log(`找到 ${files.length} 个文件\n`);

  files.forEach(file => {
    try {
      processFile(file);
    } catch (error) {
      console.error(`处理文件失败 ${file}:`, error.message);
    }
  });
}

// 主执行逻辑
console.log('====================================');
console.log('  字体优化脚本');
console.log('====================================\n');

// 处理不同目录
const patterns = [
  'src/pages/*.tsx',
  'src/components/**/*.tsx',
  'src/components/*.tsx',
];

patterns.forEach(pattern => processDirectory(pattern));

// 输出统计报告
console.log('\n====================================');
console.log('  修改统计报告');
console.log('====================================\n');
console.log(`处理文件数: ${stats.filesProcessed}`);
console.log(`总修改数: ${stats.totalChanges}\n`);
console.log('按类别统计:');
console.log(`  - 错误提示: ${stats.changesByType.errorMessages}`);
console.log(`  - 警告提示: ${stats.changesByType.warningMessages}`);
console.log(`  - 成功提示: ${stats.changesByType.successMessages}`);
console.log(`  - 辅助文字: ${stats.changesByType.helperText}`);
console.log(`  - 颜色升级: ${stats.changesByType.grayColorUpgrade}`);
console.log(`  - 其他text-xs: ${stats.changesByType.otherTextXs}`);

if (stats.preservedTextXs.length > 0) {
  console.log(`\n保留的text-xs (${stats.preservedTextXs.length}处):`);
  const grouped = stats.preservedTextXs.reduce((acc, item) => {
    if (!acc[item.file]) acc[item.file] = [];
    acc[item.file].push(item);
    return acc;
  }, {});

  Object.entries(grouped).forEach(([file, items]) => {
    console.log(`\n  ${file}:`);
    items.slice(0, 3).forEach(item => {
      console.log(`    行 ${item.line}: ${item.content}`);
    });
    if (items.length > 3) {
      console.log(`    ... 还有 ${items.length - 3} 处`);
    }
  });
}

console.log('\n====================================');
console.log('完成!');
console.log('====================================\n');
