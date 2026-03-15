import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import ts from 'typescript'
import tsdocPkg from '@microsoft/tsdoc'

const { ParserMessageLogLevel, TSDocParser } = tsdocPkg

const ROOT = process.cwd()
const PACKAGE_NAMES = ['notion-type', 'notion-data', 'notion-react', 'notion-vue']
const OUTPUT_DIR = path.join(ROOT, 'docs', 'tsdoc')
const OUTPUT_JSON_DIR = path.join(OUTPUT_DIR, 'json')
const OUTPUT_PAGES_DIR = path.join(OUTPUT_DIR, 'pages')
const OUTPUT_API_DOCS_JSON = path.join(OUTPUT_DIR, 'api-docs.json')

const mode = process.argv.includes('--check')
  ? 'check'
  : process.argv.includes('--export')
    ? 'export'
    : 'export'

function hasExportModifier(node) {
  return Array.isArray(node.modifiers) && node.modifiers.some((modifier) => {
    return modifier.kind === ts.SyntaxKind.ExportKeyword || modifier.kind === ts.SyntaxKind.DefaultKeyword
  })
}

function safeGetText(node, sourceFile) {
  if (!node) return ''
  try {
    return node.getText(sourceFile)
  } catch {
    return ''
  }
}

function getNodeNames(node, sourceFile) {
  if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node)) {
    const name = safeGetText(node.name, sourceFile)
    return name ? [name] : ['default']
  }

  if (ts.isVariableStatement(node)) {
    return node.declarationList.declarations
      .map((decl) => safeGetText(decl.name, sourceFile))
      .filter(Boolean)
  }

  if (ts.isModuleDeclaration(node)) {
    const name = safeGetText(node.name, sourceFile)
    return name ? [name] : []
  }

  return []
}

function getTSDocCommentText(sourceFile, node) {
  const sourceText = sourceFile.getFullText()
  const ranges = ts.getLeadingCommentRanges(sourceText, node.getFullStart()) || []
  const blockComments = ranges
    .filter((range) => sourceText.slice(range.pos, range.pos + 3) === '/**')
    .map((range) => sourceText.slice(range.pos, range.end))

  if (!blockComments.length) return ''
  return blockComments[blockComments.length - 1]
}

function sectionToText(section) {
  if (!section || !Array.isArray(section.nodes)) return ''

  const renderNode = (node) => {
    if (!node) return ''

    if (typeof node.text === 'string') return node.text
    if (typeof node.code === 'string') return `\`${node.code}\``

    if (typeof node.getChildNodes === 'function') {
      return node.getChildNodes().map(renderNode).join('')
    }

    if (Array.isArray(node.nodes)) {
      return node.nodes.map(renderNode).join('')
    }

    return ''
  }

  return section.nodes.map(renderNode).join('').replace(/\s+/g, ' ').trim()
}

function splitBilingualSummary(summary) {
  const value = `${summary || ''}`.trim()
  if (!value) {
    return {
      en: '',
      zh: ''
    }
  }

  const compact = value.replace(/\s+/g, ' ').trim()
  const pair = compact.match(/EN\s*:\s*([\s\S]*?)\s*ZH\s*:\s*([\s\S]*)/i)
  if (pair) {
    return {
      en: (pair[1] || '').trim(),
      zh: (pair[2] || '').trim()
    }
  }

  if (/^[\x00-\x7F]+$/.test(compact)) {
    return { en: compact, zh: '' }
  }

  return { en: '', zh: compact }
}

function escapeTableCell(value) {
  return `${value || ''}`.replace(/\|/g, '\\|').replace(/\n+/g, ' ')
}

function slugify(value) {
  return `${value || ''}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function buildSymbolAnchor(entry) {
  const symbolPart = slugify(entry.symbol)
  const kindPart = slugify(entry.kind)
  return [symbolPart, kindPart].filter(Boolean).join('-') || 'symbol'
}

function collectModifierTags(docComment) {
  const nodes = docComment?.modifierTagSet?.nodes || []
  return nodes.map((node) => `${node?.tagName || ''}`.trim()).filter(Boolean)
}

function collectBlockTags(docComment) {
  const blocks = docComment?.customBlocks || []
  return blocks.map((block) => `${block?.blockTag?.tagName || ''}`.trim()).filter(Boolean)
}

function collectParamDocs(docComment) {
  const blocks = docComment?.params?.blocks || []
  return blocks.map((block) => {
    const description = sectionToText(block?.content)
    const bilingual = splitBilingualSummary(description)
    return {
      name: `${block?.parameterName || ''}`,
      description,
      descriptionEn: bilingual.en,
      descriptionZh: bilingual.zh
    }
  })
}

function collectReturnsDoc(docComment) {
  const description = sectionToText(docComment?.returnsBlock?.content)
  if (!description) return null
  const bilingual = splitBilingualSummary(description)
  return {
    description,
    descriptionEn: bilingual.en,
    descriptionZh: bilingual.zh
  }
}

function collectRemarksDoc(docComment) {
  const description = sectionToText(docComment?.remarksBlock?.content)
  if (!description) return null
  const bilingual = splitBilingualSummary(description)
  return {
    description,
    descriptionEn: bilingual.en,
    descriptionZh: bilingual.zh
  }
}

function loadProgramForPackage(packageName) {
  const tsconfigPath = path.join(ROOT, 'packages', packageName, 'tsconfig.json')
  const readResult = ts.readConfigFile(tsconfigPath, ts.sys.readFile)
  if (readResult.error) {
    throw new Error(`Failed to read tsconfig: ${tsconfigPath}`)
  }

  const parsed = ts.parseJsonConfigFileContent(readResult.config, ts.sys, path.dirname(tsconfigPath))
  return ts.createProgram({
    rootNames: parsed.fileNames,
    options: {
      ...parsed.options,
      noEmit: true
    }
  })
}

function collectExportedEntries(packageName, parser) {
  const program = loadProgramForPackage(packageName)
  const entries = []
  const issues = []
  const packageSrcSegment = path.join('packages', packageName, 'src')

  for (const sourceFile of program.getSourceFiles()) {
    const normalizedPath = sourceFile.fileName.replace(/\\/g, '/')
    const expectedSegment = packageSrcSegment.replace(/\\/g, '/')
    if (!normalizedPath.includes(expectedSegment) || sourceFile.isDeclarationFile) continue

    sourceFile.forEachChild((node) => {
      if (!hasExportModifier(node)) return

      const names = getNodeNames(node, sourceFile)
      if (!names.length) return

      const commentText = getTSDocCommentText(sourceFile, node)
      if (!commentText) return

      const parseResult = parser.parseString(commentText)
      const relFile = path.relative(ROOT, sourceFile.fileName).replace(/\\/g, '/')
      const kind = ts.SyntaxKind[node.kind]

      for (const message of parseResult.log.messages) {
        if (message.logLevel >= ParserMessageLogLevel.Warning) {
          issues.push({
            packageName,
            file: relFile,
            symbol: names.join(', '),
            text: message.text,
            level: ParserMessageLogLevel[message.logLevel]
          })
        }
      }

      const summary = sectionToText(parseResult.docComment.summarySection)
      const bilingual = splitBilingualSummary(summary)
      const params = collectParamDocs(parseResult.docComment)
      const returns = collectReturnsDoc(parseResult.docComment)
      const remarks = collectRemarksDoc(parseResult.docComment)
      const tags = Array.from(new Set([
        ...collectModifierTags(parseResult.docComment),
        ...collectBlockTags(parseResult.docComment)
      ]))

      for (const name of names) {
        const entry = {
          packageName,
          file: relFile,
          kind,
          symbol: name,
          anchor: '',
          summary,
          summaryEn: bilingual.en,
          summaryZh: bilingual.zh,
          params,
          returns,
          remarks,
          tags,
          tsdoc: commentText.trim()
        }
        entry.anchor = buildSymbolAnchor(entry)
        entries.push(entry)
      }
    })
  }

  return { entries, issues }
}

async function writePackageDocs(packageName, entries) {
  const lines = [
    `# ${packageName} API TSDoc`,
    '',
    `Generated from source exports with Microsoft TSDoc parser.`,
    `基于 Microsoft TSDoc 解析器从源码导出生成。`,
    '',
    `Total symbols: ${entries.length}`,
    ''
  ]

  for (const entry of entries) {
    lines.push(`<a id="${entry.anchor}"></a>`)
    lines.push('')
    lines.push(`## ${entry.symbol}`)
    lines.push('')
    lines.push(`- Anchor: \`${entry.anchor}\``)
    lines.push(`- Kind: \`${entry.kind}\``)
    lines.push(`- File: \`${entry.file}\``)
    lines.push(`- Summary: ${entry.summary || '(empty summary)'}`)

    if (entry.params.length) {
      lines.push('- Params:')
      for (const param of entry.params) {
        lines.push(`  - \`${param.name}\`: ${param.description || '(empty)'}`)
      }
    }

    if (entry.returns?.description) {
      lines.push(`- Returns: ${entry.returns.description}`)
    }

    if (entry.tags.length) {
      lines.push(`- Tags: ${entry.tags.join(', ')}`)
    }

    lines.push('')
    lines.push('```ts')
    lines.push(entry.tsdoc)
    lines.push('```')
    lines.push('')
  }

  await fs.mkdir(OUTPUT_DIR, { recursive: true })
  await fs.writeFile(path.join(OUTPUT_DIR, `${packageName}.md`), lines.join('\n'), 'utf8')
}

async function writeBilingualPage(packageName, entries) {
  const lines = [
    `# ${packageName} API (EN | 中文)`,
    '',
    'This page is generated from TSDoc summaries.',
    '本页由 TSDoc 摘要自动生成。',
    '',
    '| Symbol | Kind | File | EN | 中文 |',
    '| --- | --- | --- | --- | --- |'
  ]

  for (const entry of entries) {
    const symbolLink = `[${entry.symbol}](../${packageName}.md#${entry.anchor})`
    lines.push(`| ${escapeTableCell(symbolLink)} | ${escapeTableCell(entry.kind)} | ${escapeTableCell(entry.file)} | ${escapeTableCell(entry.summaryEn || '')} | ${escapeTableCell(entry.summaryZh || '')} |`)
  }

  lines.push('')
  await fs.mkdir(OUTPUT_PAGES_DIR, { recursive: true })
  await fs.writeFile(path.join(OUTPUT_PAGES_DIR, `${packageName}.md`), lines.join('\n'), 'utf8')
}

async function writeJsonOutputs(allByPackage, issues) {
  const generatedAt = new Date().toISOString()
  await fs.mkdir(OUTPUT_JSON_DIR, { recursive: true })
  const flatSymbols = []

  for (const [packageName, entries] of Object.entries(allByPackage)) {
    flatSymbols.push(...entries)
    const payload = {
      package: packageName,
      generatedAt,
      totalSymbols: entries.length,
      symbols: entries
    }
    await fs.writeFile(path.join(OUTPUT_JSON_DIR, `${packageName}.json`), `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  }

  const indexPayload = {
    generatedAt,
    packages: Object.keys(allByPackage).map((packageName) => ({
      name: packageName,
      totalSymbols: allByPackage[packageName].length,
      json: `json/${packageName}.json`,
      page: `pages/${packageName}.md`,
      markdown: `${packageName}.md`
    })),
    aggregateJson: 'api-docs.json',
    issues
  }

  await fs.writeFile(path.join(OUTPUT_DIR, 'index.json'), `${JSON.stringify(indexPayload, null, 2)}\n`, 'utf8')

  const aggregatePayload = {
    generatedAt,
    totalSymbols: flatSymbols.length,
    packages: indexPayload.packages,
    symbols: flatSymbols
  }

  await fs.writeFile(OUTPUT_API_DOCS_JSON, `${JSON.stringify(aggregatePayload, null, 2)}\n`, 'utf8')
}

async function main() {
  const parser = new TSDocParser()
  let hasIssues = false
  let totalEntries = 0
  const issuesAll = []
  const allByPackage = {}

  for (const packageName of PACKAGE_NAMES) {
    const { entries, issues } = collectExportedEntries(packageName, parser)
    totalEntries += entries.length
    allByPackage[packageName] = entries

    if (mode === 'export') {
      await writePackageDocs(packageName, entries)
      await writeBilingualPage(packageName, entries)
    }

    if (issues.length) {
      hasIssues = true
      issuesAll.push(...issues)
      for (const issue of issues) {
        console.error(`[${issue.packageName}] ${issue.level} ${issue.file} (${issue.symbol}): ${issue.text}`)
      }
    }

    console.log(`[tsdoc] ${packageName}: ${entries.length} documented exports`)
  }

  if (mode === 'export') {
    await writeJsonOutputs(allByPackage, issuesAll)
  }

  if (hasIssues) {
    console.error('[tsdoc] Found TSDoc parser warnings/errors. Please fix comments for Microsoft TSDoc compatibility.')
    process.exitCode = 1
    return
  }

  if (mode === 'export') {
    console.log(`[tsdoc] Exported docs/pages/json to ${path.relative(ROOT, OUTPUT_DIR)} (${totalEntries} symbols)`)
  } else {
    console.log(`[tsdoc] Check passed (${totalEntries} symbols)`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
