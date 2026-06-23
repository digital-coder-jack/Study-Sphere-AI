package com.aichat.app.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.aichat.app.domain.model.AiModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ModelSelectorSheet(
    current: AiModel,
    onSelect: (AiModel) -> Unit,
    onDismiss: () -> Unit,
) {
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(Modifier.padding(bottom = 24.dp)) {
            Text(
                "Choose a model",
                Modifier.padding(16.dp),
                fontWeight = FontWeight.Bold,
            )
            AiModel.entries.forEach { model ->
                Row(
                    Modifier
                        .fillMaxWidth()
                        .clickable { onSelect(model) }
                        .padding(horizontal = 20.dp, vertical = 14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(Modifier.weight(1f)) {
                        Text(model.label, fontWeight = FontWeight.Medium)
                        Text(subtitle(model))
                    }
                    if (model == current) Icon(Icons.Default.Check, "Selected")
                }
            }
        }
    }
}

private fun subtitle(model: AiModel) = when (model) {
    AiModel.AUTO -> "Fast first, falls back automatically"
    AiModel.GROQ -> "Groq — fastest inference"
    AiModel.GEMINI -> "Google Gemini — reasoning"
    AiModel.KIMI -> "Kimi — long context"
}
