#!/usr/bin/env node

/**
 * ドキュメントリンク整合性チェックツール
 * 
 * 使用方法:
 *   node scripts/check-doc-links.js
 *   node scripts/check-doc-links.js --fix  # 自動修正（準備中）
 */

const fs = require('fs');
const path = require('path');

class DocumentLinkChecker {
  constructor() {
    this.docsDir = path.join(__dirname, '../docs');
    this.errors = [];
    this.warnings = [];
    this.stats = {
      totalFiles: 0,
      totalLinks: 0,
      brokenLinks: 0,
      missingFiles: 0
    };
  }

  /**
   * メインチェック実行
   */
  async run() {
    console.log('🔍 ドキュメントリンク整合性チェック開始...\n');
    
    try {
      const markdownFiles = this.findMarkdownFiles(this.docsDir);
      this.stats.totalFiles = markdownFiles.length;
      
      console.log(`📄 対象ファイル: ${markdownFiles.length}個`);
      
      for (const filePath of markdownFiles) {
        await this.checkFile(filePath);
      }
      
      this.printResults();
      
    } catch (error) {
      console.error('❌ エラーが発生しました:', error.message);
      process.exit(1);
    }
  }

  /**
   * Markdownファイルを再帰的に検索
   */
  findMarkdownFiles(dir) {
    const files = [];
    
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        // node_modules などを除外
        if (!item.startsWith('.') && item !== 'node_modules') {
          files.push(...this.findMarkdownFiles(fullPath));
        }
      } else if (item.endsWith('.md')) {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  /**
   * 単一ファイルのリンクチェック
   */
  async checkFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const relativePath = path.relative(this.docsDir, filePath);
    
    // Markdownリンクの正規表現
    const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
    let match;
    
    while ((match = linkRegex.exec(content)) !== null) {
      this.stats.totalLinks++;
      
      const linkText = match[1];
      const linkUrl = match[2];
      
      // 外部URLはスキップ
      if (linkUrl.startsWith('http') || linkUrl.startsWith('mailto:')) {
        continue;
      }
      
      // 内部リンクをチェック
      await this.checkInternalLink(filePath, relativePath, linkText, linkUrl);
    }
  }

  /**
   * 内部リンクの存在確認
   */
  async checkInternalLink(sourceFile, sourceRelative, linkText, linkUrl) {
    // アンカーリンクを分離
    const [filePart, anchor] = linkUrl.split('#');
    
    if (!filePart) {
      // 同一ページ内アンカーはスキップ
      return;
    }
    
    // 相対パスを絶対パスに変換
    const sourceDir = path.dirname(sourceFile);
    const targetPath = path.resolve(sourceDir, filePart);
    
    // ファイルの存在確認
    if (!fs.existsSync(targetPath)) {
      this.stats.brokenLinks++;
      this.errors.push({
        type: 'missing-file',
        source: sourceRelative,
        link: linkUrl,
        linkText: linkText,
        target: path.relative(this.docsDir, targetPath)
      });
    } else {
      // ファイルが存在する場合、アンカーもチェック（簡易版）
      if (anchor) {
        const targetContent = fs.readFileSync(targetPath, 'utf8');
        const anchorRegex = new RegExp(`#{1,6}\\s+.*${anchor.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}`, 'i');
        
        if (!anchorRegex.test(targetContent)) {
          this.warnings.push({
            type: 'missing-anchor',
            source: sourceRelative,
            link: linkUrl,
            anchor: anchor,
            target: path.relative(this.docsDir, targetPath)
          });
        }
      }
    }
  }

  /**
   * 結果の出力
   */
  printResults() {
    console.log('\n📊 チェック結果:');
    console.log(`  ファイル数: ${this.stats.totalFiles}`);
    console.log(`  リンク数: ${this.stats.totalLinks}`);
    console.log(`  エラー数: ${this.errors.length}`);
    console.log(`  警告数: ${this.warnings.length}`);
    
    if (this.errors.length > 0) {
      console.log('\n❌ エラー (ファイルが存在しません):');
      this.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error.source}`);
        console.log(`     リンク: [${error.linkText}](${error.link})`);
        console.log(`     対象: ${error.target}`);
        console.log('');
      });
    }
    
    if (this.warnings.length > 0) {
      console.log('\n⚠️ 警告 (アンカーが見つかりません):');
      this.warnings.forEach((warning, index) => {
        console.log(`  ${index + 1}. ${warning.source}`);
        console.log(`     リンク: ${warning.link}`);
        console.log(`     アンカー: #${warning.anchor}`);
        console.log('');
      });
    }
    
    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('\n✅ すべてのリンクが正常です！');
    } else {
      console.log(`\n📈 改善提案:`);
      console.log(`  - 404リンク率: ${((this.errors.length / this.stats.totalLinks) * 100).toFixed(1)}%`);
      
      if (this.errors.length > 0) {
        console.log(`  - 最優先: ${this.errors.length}個の不正リンクを修正`);
      }
      
      if (this.warnings.length > 0) {
        console.log(`  - 次優先: ${this.warnings.length}個のアンカーリンクを確認`);
      }
    }
    
    // 終了コード
    process.exit(this.errors.length > 0 ? 1 : 0);
  }
}

// 実行
if (require.main === module) {
  const checker = new DocumentLinkChecker();
  checker.run().catch(console.error);
}

module.exports = DocumentLinkChecker;