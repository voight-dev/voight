# AI Provider Setup Guide

Voight uses AI providers to generate code explanations for detected segments. This guide will help you set up your API key to enable this feature.

## Supported Providers

Voight supports three AI providers:

1. **Google Gemini** (Default, Recommended)
2. **Anthropic Claude**
3. **OpenAI GPT**

---

## Quick Setup

### Step 1: Choose Your Provider

The default provider is **Google Gemini**, which offers a generous free tier. If you prefer a different provider, you can change it in settings.

### Step 2: Get an API Key

Follow the instructions for your chosen provider below.

### Step 3: Add API Key to Voight

1. Open VS Code Settings: `Cmd/Ctrl + ,`
2. Search for `voight.ai.apiKey`
3. Paste your API key
4. Done! You can now get AI explanations for code segments

---

## Provider-Specific Instructions

### Option 1: Google Gemini (Recommended)

**Why Gemini?**
- Free tier includes 1,500 requests per day
- Fast response times
- Good quality explanations
- Easy to set up

**Get Your API Key:**

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Click **"Get API Key"** or **"Create API Key"**
3. Select your Google Cloud project (or create a new one)
4. Copy the generated API key
5. In VS Code settings, set:
   - `voight.ai.provider`: `gemini` (default)
   - `voight.ai.apiKey`: `<your-api-key>`

**Example Settings:**
```json
{
  "voight.ai.provider": "gemini",
  "voight.ai.apiKey": "AIzaSyD..."
}
```

**Cost:** Free tier includes 1,500 requests/day. [See pricing](https://ai.google.dev/pricing)

---

### Option 2: Anthropic Claude

**Why Claude?**
- High-quality explanations
- Strong coding capabilities
- Good at understanding context

**Get Your API Key:**

1. Visit [Anthropic Console](https://console.anthropic.com/)
2. Sign up or log in
3. Navigate to **API Keys** section
4. Click **"Create Key"**
5. Copy the generated API key
6. In VS Code settings, set:
   - `voight.ai.provider`: `anthropic`
   - `voight.ai.apiKey`: `<your-api-key>`

**Example Settings:**
```json
{
  "voight.ai.provider": "anthropic",
  "voight.ai.apiKey": "sk-ant-..."
}
```

**Cost:** Pay-as-you-go pricing. $3 per million input tokens for Claude 3.5 Sonnet. [See pricing](https://www.anthropic.com/pricing)

---

### Option 3: OpenAI GPT

**Why OpenAI?**
- Well-known and reliable
- GPT-4 provides excellent explanations
- Good documentation

**Get Your API Key:**

1. Visit [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in
3. Navigate to **API Keys** section
4. Click **"Create new secret key"**
5. Copy the generated API key
6. In VS Code settings, set:
   - `voight.ai.provider`: `openai`
   - `voight.ai.apiKey`: `<your-api-key>`

**Example Settings:**
```json
{
  "voight.ai.provider": "openai",
  "voight.ai.apiKey": "sk-proj-..."
}
```

**Cost:** Pay-as-you-go pricing. $10 per million input tokens for GPT-4 Turbo. [See pricing](https://openai.com/api/pricing/)

---

## Advanced Configuration

### Custom Model

By default, Voight uses the recommended model for each provider. You can override this:

```json
{
  "voight.ai.model": "gemini-2.5-flash"  // For Gemini
  // or
  "voight.ai.model": "claude-3-5-sonnet-20241022"  // For Anthropic
  // or
  "voight.ai.model": "gpt-4-turbo-preview"  // For OpenAI
}
```

### Max Tokens

Control the length of explanations:

```json
{
  "voight.ai.maxTokens": 2048  // Default: 2048, Range: 256-8192
}
```

Higher values allow longer explanations but cost more.

---

## Testing Your Setup

After adding your API key:

1. Write or paste some code to trigger detection
2. Open the **Voight** sidebar (Activity Bar icon)
3. Click on a detected segment
4. Click the **"Explain"** button (sparkles icon ✨)
5. You should see an AI-generated explanation

If you get an error, check:
- API key is correct (no extra spaces)
- API key has appropriate permissions
- You have available credits/quota
- Your internet connection is working

---

## Security & Privacy

### API Key Storage

- API keys are stored in VS Code's settings
- Settings can be workspace-specific or global
- **Never commit** your `settings.json` with API keys to version control
- Consider using VS Code's **Settings Sync** encryption

### What Data is Sent?

When you request an explanation:
- The **code segment** is sent to the AI provider
- The **programming language** is included
- **No file paths** or other metadata

### Best Practices

1. **Use environment-specific keys**: Different keys for different projects
2. **Set usage limits**: Configure budget limits in your provider's dashboard
3. **Monitor usage**: Check your provider's usage dashboard regularly
4. **Rotate keys**: Periodically generate new API keys

---

## Troubleshooting

### "API key not configured" Error

**Solution:** Make sure you've added your API key in settings:
1. Open Settings (`Cmd/Ctrl + ,`)
2. Search for `voight.ai.apiKey`
3. Paste your API key
4. Reload VS Code if needed

### "Failed to explain code" Error

**Possible causes:**
- Invalid or expired API key
- No internet connection
- API quota exceeded
- Provider service outage

**Solutions:**
1. Verify your API key is correct
2. Check your internet connection
3. Check provider's status page:
   - [Google AI Studio Status](https://status.cloud.google.com/)
   - [Anthropic Status](https://status.anthropic.com/)
   - [OpenAI Status](https://status.openai.com/)
4. Check your usage/quota in provider dashboard

### "Rate limit exceeded" Error

**Solution:** You've hit your API rate limit. Either:
- Wait for the limit to reset (usually 1 minute)
- Upgrade your plan with the provider
- Switch to a different provider

---

## Cost Estimation

Based on typical code segment sizes (50-200 lines):

### Gemini (Free Tier)
- **Cost per explanation**: Free
- **Daily limit**: ~1,500 explanations
- **Monthly estimate**: Free

### Anthropic Claude
- **Cost per explanation**: ~$0.001-0.005
- **Monthly estimate** (100 explanations): ~$0.10-0.50

### OpenAI GPT-4
- **Cost per explanation**: ~$0.003-0.015
- **Monthly estimate** (100 explanations): ~$0.30-1.50

*Note: Costs vary based on code length and complexity*

---

## Frequently Asked Questions

### Q: Which provider is best?

**A:** For most users, **Gemini** is the best choice because:
- It's free for reasonable usage
- Quality is excellent
- Setup is simple

If you need the highest quality and don't mind paying, **Claude** is outstanding for code understanding.

### Q: Can I use multiple providers?

**A:** You can switch providers anytime in settings, but only one provider is active at a time.

### Q: Is my code safe?

**A:** Code segments are sent to the AI provider's API. Review each provider's privacy policy:
- [Google AI Privacy](https://ai.google.dev/terms)
- [Anthropic Privacy](https://www.anthropic.com/privacy)
- [OpenAI Privacy](https://openai.com/privacy/)

For sensitive code, consider:
- Using a self-hosted LLM (not currently supported)
- Disabling AI explanations for sensitive projects
- Using provider options with enhanced privacy commitments

### Q: Can I use a local/self-hosted model?

**A:** Not currently. Voight only supports cloud-based providers. Local model support may be added in the future.

---

## Support

If you're still having trouble:

1. Check the [VSCode Output panel](command:workbench.action.output.toggleOutput) and select "Voight" channel for logs
2. Open an issue on [GitHub](https://github.com/your-repo/voight/issues)
3. Include:
   - Provider you're using
   - Error message
   - Steps to reproduce

---

## Next Steps

Once your API key is configured:

1. **Explore explanations**: Try explaining different code segments
2. **Adjust settings**: Fine-tune model and token settings
3. **Save notes**: Add context notes to segments
4. **Monitor usage**: Keep an eye on your API usage

Happy coding! 🚀
