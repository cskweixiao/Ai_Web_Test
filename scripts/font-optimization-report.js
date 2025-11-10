/**
 * 字体优化报告生成器
 * 检查项目中还有哪些需要手动优化的字体相关问题
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

const issues = {
  textXsNeedUpgrade: [], // 需要从text-xs升级的
  grayColorIssues: [],   // 颜色对比度问题
  buttonTextSize: [],     // 按钮文字大小问题
  formElements: [],       // 表单元素问题
  statistics: {
    totalFiles: 0,
    filesWithTextXs: 0,
    textXsCount: 0,
    preservedTextXs: 0,
  }
};

function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const relPath = path.relative(process.cwd(), filePath);

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmed = line.trim();

    // 跳过注释
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      return;
    }

    // 1. 检查text-xs (排除应该保留的情况)
    if (trimmed.includes('text-xs')) {
      issues.statistics.textXsCount++;

      // 应该保留的情况
      const shouldPreserve =
        trimmed.includes('uppercase') ||
        trimmed.includes('tracking-wider') ||
        trimmed.includes('badge') ||
        trimmed.includes('formatDate') ||
        (trimmed.includes('font-medium') && trimmed.includes('uppercase'));

      if (shouldPreserve) {
        issues.statistics.preservedTextXs++;
      } else {
        // 检查是否是错误/警告/成功提示 - 这些应该已经被处理了
        if (trimmed.match(/text-xs.*text-(red|yellow|green|orange)/)) {
          issues.textXsNeedUpgrade.push({
            file: relPath,
            line: lineNum,
            content: trimmed.substring(0, 100),
            reason: '错误/警告/成功提示未升级'
          });
        }
        // 检查是否是表单辅助文字
        else if (trimmed.match(/text-xs.*text-gray/) &&
                 (trimmed.includes('mt-') || trimmed.includes('helper') || trimmed.includes('error'))) {
          issues.textXsNeedUpgrade.push({
            file: relPath,
            line: lineNum,
            content: trimmed.substring(0, 100),
            reason: '表单辅助文字未升级'
          });
        }
      }
    }

    // 2. 检查text-gray-400 (可能需要升级的)
    if (trimmed.match(/\btext-gray-400\b/) &&
        !trimmed.includes('icon') &&
        !trimmed.includes('Icon')) {
      issues.grayColorIssues.push({
        file: relPath,
        line: lineNum,
        content: trimmed.substring(0, 100),
        reason: '可能需要升级为text-gray-600'
      });
    }

    // 3. 检查按钮text-sm (可能需要升级为text-base)
    if (trimmed.match(/<button.*text-sm/) ||
        trimmed.match(/Button.*text-sm/)) {
      // 排除小按钮
      if (!trimmed.includes('size="sm"') && !trimmed.includes("size='sm'")) {
        issues.buttonTextSize.push({
          file: relPath,
          line: lineNum,
          content: trimmed.substring(0, 100),
          reason: '按钮可能需要升级为text-base'
        });
      }
    }

    // 4. 检查表单input/textarea (应该使用text-base)
    if ((trimmed.match(/<input/) || trimmed.match(/<textarea/)) &&
        trimmed.match(/text-sm/)) {
      issues.formElements.push({
        file: relPath,
        line: lineNum,
        content: trimmed.substring(0, 100),
        reason: '表单输入框应该使用text-base'
      });
    }
  });

  if (content.includes('text-xs')) {
    issues.statistics.filesWithTextXs++;
  }
}

function generateReport() {
  console.log('====================================');
  console.log('  字体优化检查报告');
  console.log('====================================\n');

  const patterns = [
    'src/pages/*.tsx',
    'src/components/**/*.tsx',
    'src/components/*.tsx',
  ];

  const allFiles = [];
  patterns.forEach(pattern => {
    const files = glob.sync(pattern);
    allFiles.push(...files);
  });

  issues.statistics.totalFiles = allFiles.length;

  console.log(`正在分析 ${allFiles.length} 个文件...\n`);

  allFiles.forEach(file => {
    analyzeFile(file);
  });

  // 输出统计信息
  console.log('====================================');
  console.log('  统计信息');
  console.log('====================================\n');
  console.log(`总文件数: ${issues.statistics.totalFiles}`);
  console.log(`包含text-xs的文件: ${issues.statistics.filesWithTextXs}`);
  console.log(`text-xs总数: ${issues.statistics.textXsCount}`);
  console.log(`保留的text-xs: ${issues.statistics.preservedTextXs}`);
  console.log(`可能需要升级的text-xs: ${issues.textXsNeedUpgrade.length}`);

  // 输出需要修复的问题
  console.log('\n====================================');
  console.log('  需要修复的问题');
  console.log('====================================\n');

  if (issues.textXsNeedUpgrade.length > 0) {
    console.log(`\n❌ 需要升级的text-xs (${issues.textXsNeedUpgrade.length}处):\n`);
    issues.textXsNeedUpgrade.slice(0, 10).forEach(issue => {
      console.log(`  ${issue.file}:${issue.line}`);
      console.log(`    原因: ${issue.reason}`);
      console.log(`    内容: ${issue.content}`);
      console.log('');
    });
    if (issues.textXsNeedUpgrade.length > 10) {
      console.log(`  ... 还有 ${issues.textXsNeedUpgrade.length - 10} 处\n`);
    }
  } else {
    console.log('✅ 所有text-xs都已正确处理\n');
  }

  if (issues.grayColorIssues.length > 0) {
    console.log(`\n⚠️  可能需要升级的text-gray-400 (${issues.grayColorIssues.length}处):\n`);
    issues.grayColorIssues.slice(0, 5).forEach(issue => {
      console.log(`  ${issue.file}:${issue.line}`);
      console.log(`    ${issue.content}`);
      console.log('');
    });
    if (issues.grayColorIssues.length > 5) {
      console.log(`  ... 还有 ${issues.grayColorIssues.length - 5} 处\n`);
    }
  } else {
    console.log('✅ 所有text-gray-400都已正确处理\n');
  }

  if (issues.buttonTextSize.length > 0) {
    console.log(`\n⚠️  按钮文字大小问题 (${issues.buttonTextSize.length}处):\n`);
    issues.buttonTextSize.slice(0, 5).forEach(issue => {
      console.log(`  ${issue.file}:${issue.line}`);
      console.log(`    ${issue.content}`);
      console.log('');
    });
    if (issues.buttonTextSize.length > 5) {
      console.log(`  ... 还有 ${issues.buttonTextSize.length - 5} 处\n`);
    }
  } else {
    console.log('✅ 所有按钮文字大小都已正确设置\n');
  }

  if (issues.formElements.length > 0) {
    console.log(`\n⚠️  表单元素文字大小问题 (${issues.formElements.length}处):\n`);
    issues.formElements.slice(0, 5).forEach(issue => {
      console.log(`  ${issue.file}:${issue.line}`);
      console.log(`    ${issue.content}`);
      console.log('');
    });
    if (issues.formElements.length > 5) {
      console.log(`  ... 还有 ${issues.formElements.length - 5} 处\n`);
    }
  } else {
    console.log('✅ 所有表单元素文字大小都已正确设置\n');
  }

  console.log('====================================');
  console.log('  检查完成');
  console.log('====================================\n');

  // 返回是否有问题
  const hasIssues =
    issues.textXsNeedUpgrade.length > 0 ||
    issues.grayColorIssues.length > 0 ||
    issues.buttonTextSize.length > 0 ||
    issues.formElements.length > 0;

  if (!hasIssues) {
    console.log('🎉 所有字体优化都已完成!\n');
  } else {
    console.log('⚠️  还有一些问题需要手动检查和修复\n');
  }
}

generateReport();
