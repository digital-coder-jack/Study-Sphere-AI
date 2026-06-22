package com.studysphere.ai.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.studysphere.ai.ui.theme.Cyan
import com.studysphere.ai.ui.theme.Indigo

/* =========================================================================
 *  Lightweight, dependency-free Markdown renderer tuned for AI assistant
 *  replies (ChatGPT / Gemini / Claude / Perplexity style). Supports:
 *   - Headings (#, ##, ###)
 *   - Bold **x**, italic *x* / _x_, inline `code`
 *   - Bullet (-, *, •) and numbered (1.) lists
 *   - Fenced code blocks ``` with a copy button
 *   - Blockquotes (>)
 *   - Simple pipe tables
 *   - Horizontal rules (---)
 * ========================================================================= */

private sealed interface MdBlock {
    data class Heading(val level: Int, val text: String) : MdBlock
    data class Paragraph(val text: String) : MdBlock
    data class BulletItem(val text: String, val ordered: Boolean, val index: Int) : MdBlock
    data class Code(val language: String, val code: String) : MdBlock
    data class Quote(val text: String) : MdBlock
    data class Table(val rows: List<List<String>>, val hasHeader: Boolean) : MdBlock
    data object Divider : MdBlock
}

private fun parseMarkdown(src: String): List<MdBlock> {
    val blocks = mutableListOf<MdBlock>()
    val lines = src.replace("\r\n", "\n").split("\n")
    var i = 0
    var orderedCounter = 0

    while (i < lines.size) {
        val raw = lines[i]
        val line = raw.trimEnd()
        val trimmed = line.trim()

        when {
            // Fenced code block
            trimmed.startsWith("```") -> {
                val lang = trimmed.removePrefix("```").trim()
                val sb = StringBuilder()
                i++
                while (i < lines.size && !lines[i].trim().startsWith("```")) {
                    sb.appendLine(lines[i])
                    i++
                }
                i++ // closing fence
                blocks += MdBlock.Code(lang, sb.toString().trimEnd('\n'))
                orderedCounter = 0
            }

            trimmed.isEmpty() -> {
                orderedCounter = 0
                i++
            }

            trimmed.startsWith("### ") -> { blocks += MdBlock.Heading(3, trimmed.removePrefix("### ")); i++ }
            trimmed.startsWith("## ") -> { blocks += MdBlock.Heading(2, trimmed.removePrefix("## ")); i++ }
            trimmed.startsWith("# ") -> { blocks += MdBlock.Heading(1, trimmed.removePrefix("# ")); i++ }

            trimmed == "---" || trimmed == "***" || trimmed == "___" -> {
                blocks += MdBlock.Divider; i++
            }

            trimmed.startsWith("> ") -> {
                blocks += MdBlock.Quote(trimmed.removePrefix("> ")); i++
            }

            // Table: a line with pipes followed by a separator row
            trimmed.contains("|") && i + 1 < lines.size &&
                lines[i + 1].trim().matches(Regex("\\|?[\\s:|-]+\\|?")) &&
                lines[i + 1].contains("-") -> {
                val rows = mutableListOf<List<String>>()
                rows += splitRow(trimmed)
                i += 2 // skip header + separator
                while (i < lines.size && lines[i].trim().contains("|") && lines[i].trim().isNotEmpty()) {
                    rows += splitRow(lines[i].trim())
                    i++
                }
                blocks += MdBlock.Table(rows, hasHeader = true)
                orderedCounter = 0
            }

            trimmed.startsWith("- ") || trimmed.startsWith("* ") || trimmed.startsWith("• ") -> {
                blocks += MdBlock.BulletItem(trimmed.drop(2), ordered = false, index = 0)
                orderedCounter = 0
                i++
            }

            trimmed.matches(Regex("^\\d+\\.\\s.*")) -> {
                orderedCounter++
                val content = trimmed.replaceFirst(Regex("^\\d+\\.\\s"), "")
                blocks += MdBlock.BulletItem(content, ordered = true, index = orderedCounter)
                i++
            }

            else -> {
                blocks += MdBlock.Paragraph(trimmed)
                orderedCounter = 0
                i++
            }
        }
    }
    return blocks
}

private fun splitRow(line: String): List<String> =
    line.trim().trim('|').split("|").map { it.trim() }

/** Renders inline markdown (**bold**, *italic*, `code`) into an AnnotatedString. */
private fun inline(text: String, codeColor: Color): AnnotatedString = buildAnnotatedString {
    var i = 0
    while (i < text.length) {
        val c = text[i]
        when {
            text.startsWith("**", i) -> {
                val end = text.indexOf("**", i + 2)
                if (end > 0) {
                    withStyle(SpanStyle(fontWeight = FontWeight.Bold)) {
                        append(text.substring(i + 2, end))
                    }
                    i = end + 2
                } else { append(c); i++ }
            }
            c == '`' -> {
                val end = text.indexOf('`', i + 1)
                if (end > 0) {
                    withStyle(
                        SpanStyle(
                            fontFamily = FontFamily.Monospace,
                            background = codeColor.copy(alpha = 0.16f),
                            color = codeColor,
                            fontSize = 13.5.sp
                        )
                    ) { append(text.substring(i + 1, end)) }
                    i = end + 1
                } else { append(c); i++ }
            }
            (c == '*' || c == '_') -> {
                val end = text.indexOf(c, i + 1)
                if (end > i + 1) {
                    withStyle(SpanStyle(fontStyle = FontStyle.Italic)) {
                        append(text.substring(i + 1, end))
                    }
                    i = end + 1
                } else { append(c); i++ }
            }
            else -> { append(c); i++ }
        }
    }
}

@Composable
fun MarkdownText(
    markdown: String,
    modifier: Modifier = Modifier,
    color: Color = MaterialTheme.colorScheme.onSurface
) {
    val blocks = remember(markdown) { parseMarkdown(markdown) }
    val codeColor = Cyan

    Column(modifier, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        blocks.forEach { block ->
            when (block) {
                is MdBlock.Heading -> Text(
                    text = inline(block.text, codeColor),
                    color = color,
                    style = when (block.level) {
                        1 -> MaterialTheme.typography.titleLarge
                        2 -> MaterialTheme.typography.titleMedium
                        else -> MaterialTheme.typography.titleSmall
                    },
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(top = 4.dp)
                )

                is MdBlock.Paragraph -> Text(
                    text = inline(block.text, codeColor),
                    color = color,
                    style = MaterialTheme.typography.bodyMedium
                )

                is MdBlock.BulletItem -> Row(Modifier.fillMaxWidth()) {
                    Text(
                        if (block.ordered) "${block.index}." else "•",
                        color = Indigo,
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.width(if (block.ordered) 24.dp else 18.dp)
                    )
                    Text(
                        text = inline(block.text, codeColor),
                        color = color,
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.weight(1f)
                    )
                }

                is MdBlock.Code -> CodeBlock(block.language, block.code)

                is MdBlock.Quote -> Row(
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(MaterialTheme.colorScheme.surfaceContainerHigh.copy(alpha = 0.5f))
                ) {
                    Box(
                        Modifier
                            .width(3.dp)
                            .background(Indigo)
                            .padding(vertical = 12.dp)
                            .size(width = 3.dp, height = 18.dp)
                    )
                    Text(
                        text = inline(block.text, codeColor),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodyMedium,
                        fontStyle = FontStyle.Italic,
                        modifier = Modifier.padding(10.dp)
                    )
                }

                is MdBlock.Table -> MarkdownTable(block.rows, block.hasHeader, codeColor)

                MdBlock.Divider -> Box(
                    Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp)
                        .size(height = 1.dp, width = 1.dp)
                        .fillMaxWidth()
                        .background(MaterialTheme.colorScheme.outline.copy(alpha = 0.5f))
                )
            }
        }
    }
}

@Composable
private fun CodeBlock(language: String, code: String) {
    val clipboard = LocalClipboardManager.current
    var copied by remember { mutableStateOf(false) }

    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Color(0xFF0B0F1F))
            .border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f), RoundedCornerShape(12.dp))
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .background(Color(0xFF11162A))
                .padding(horizontal = 12.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                language.ifBlank { "code" },
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontFamily = FontFamily.Monospace
            )
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .clip(RoundedCornerShape(6.dp))
                    .clickable {
                        clipboard.setText(AnnotatedString(code))
                        copied = true
                    }
                    .padding(horizontal = 6.dp, vertical = 2.dp)
            ) {
                Icon(
                    if (copied) Icons.Default.Check else Icons.Default.ContentCopy,
                    contentDescription = "Copy code",
                    tint = if (copied) Cyan else MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(14.dp)
                )
                Spacer(Modifier.width(4.dp))
                Text(
                    if (copied) "Copied" else "Copy",
                    style = MaterialTheme.typography.labelSmall,
                    color = if (copied) Cyan else MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
        Box(
            Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
        ) {
            Text(
                buildCodeHighlight(code),
                modifier = Modifier.padding(12.dp),
                fontFamily = FontFamily.Monospace,
                fontSize = 13.sp,
                color = Color(0xFFE6E9F5)
            )
        }
    }
}

/** Very light syntax tinting: keywords, strings, numbers, comments. */
private val CODE_KEYWORDS = setOf(
    "fun", "val", "var", "if", "else", "for", "while", "return", "class",
    "object", "import", "package", "public", "private", "void", "int",
    "String", "def", "function", "const", "let", "new", "true", "false",
    "null", "None", "True", "False", "print", "println", "in", "is", "when"
)

private fun buildCodeHighlight(code: String): AnnotatedString = buildAnnotatedString {
    val keywordColor = Color(0xFFA855F7)
    val stringColor = Color(0xFF7DD3A0)
    val numberColor = Color(0xFF22D3EE)
    val commentColor = Color(0xFF6B7394)

    code.split("\n").forEachIndexed { idx, line ->
        if (idx > 0) append("\n")
        val commentIdx = lineCommentIndex(line)
        val codePart = if (commentIdx >= 0) line.substring(0, commentIdx) else line
        val comment = if (commentIdx >= 0) line.substring(commentIdx) else ""

        val tokens = Regex("(\"[^\"]*\"|'[^']*'|\\b\\w+\\b|\\W)").findAll(codePart)
        for (m in tokens) {
            val t = m.value
            when {
                t.startsWith("\"") || t.startsWith("'") ->
                    withStyle(SpanStyle(color = stringColor)) { append(t) }
                t.matches(Regex("\\d+(\\.\\d+)?")) ->
                    withStyle(SpanStyle(color = numberColor)) { append(t) }
                t in CODE_KEYWORDS ->
                    withStyle(SpanStyle(color = keywordColor, fontWeight = FontWeight.Bold)) { append(t) }
                else -> append(t)
            }
        }
        if (comment.isNotEmpty()) {
            withStyle(SpanStyle(color = commentColor, fontStyle = FontStyle.Italic)) { append(comment) }
        }
    }
}

private fun lineCommentIndex(line: String): Int {
    val slashes = line.indexOf("//")
    val hash = line.indexOf("#")
    return when {
        slashes >= 0 && (hash < 0 || slashes < hash) -> slashes
        hash >= 0 -> hash
        else -> -1
    }
}

@Composable
private fun MarkdownTable(rows: List<List<String>>, hasHeader: Boolean, codeColor: Color) {
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.5f), RoundedCornerShape(10.dp))
    ) {
        rows.forEachIndexed { rIdx, row ->
            val isHeader = hasHeader && rIdx == 0
            Row(
                Modifier
                    .fillMaxWidth()
                    .background(
                        if (isHeader) MaterialTheme.colorScheme.surfaceContainerHigh
                        else if (rIdx % 2 == 0) Color.Transparent
                        else MaterialTheme.colorScheme.surfaceContainerHigh.copy(alpha = 0.25f)
                    )
            ) {
                row.forEach { cell ->
                    Text(
                        text = inline(cell, codeColor),
                        modifier = Modifier
                            .weight(1f)
                            .padding(horizontal = 10.dp, vertical = 8.dp),
                        style = MaterialTheme.typography.bodySmall,
                        color = if (isHeader) MaterialTheme.colorScheme.onSurface
                        else MaterialTheme.colorScheme.onSurfaceVariant,
                        fontWeight = if (isHeader) FontWeight.Bold else FontWeight.Normal
                    )
                }
            }
        }
    }
}
