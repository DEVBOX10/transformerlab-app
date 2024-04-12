import {
  Button,
  CircularProgress,
  Select,
  Sheet,
  Textarea,
  Option,
  Typography,
  FormLabel,
  Box,
} from '@mui/joy';
import { SendIcon } from 'lucide-react';
import { useState } from 'react';

import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import * as chatAPI from 'renderer/lib/transformerlab-api-sdk';

/* We hardcode these below but later on we will fetch them from the API */
const templates = [
  {
    id: 'a',
    style: 'completion',
    title: 'Convert to Standard English',
    template:
      'You will be provided with a statement, and your task is to convert it to standard English.\n\nStatement:\n\n{text}\n\nStandard English:\n',
    temperature: 0.7,
    max_tokens: 64,
    top_p: 1,
  },
  {
    id: 'b',
    style: 'completion',
    title: 'Summarize for Second-Grade Student',
    template:
      'Summarize content you are provided with for a second-grade student.\n\nContent:\n{text}\n\nSummary:\n',
  },
  {
    id: 'c',
    style: 'completion',
    title: 'Convert CSV to Markdown Table',
    template:
      'You are an expert in data formatting. For the following csv data, output it as a markdown table.\nOutput the table only.\n```{text}```',
  },
  {
    id: 'd',
    style: 'completion',
    title: 'Parse Unstructured Data',
    template:
      'You are a data scientist tasked with parsing unstructured data. Given the following text, output the structured data.\n\n{text}\n\nStructured Data:\n',
  },
  {
    id: 'e',
    style: 'completion',
    title: 'Write a Summary',
    template:
      'You are a journalist tasked with writing a summary of the following text.\n\n{text}\n\nSummary:\n',
  },
];

export default function TemplatedCompletion({ experimentInfo }) {
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showTemplate, setShowTemplate] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [completionOutput, setCompletionOutput] = useState('');

  const sendTemplatedCompletionToLLM = async (element) => {
    if (!selectedTemplate) {
      return;
    }

    const text = element.value;

    const template = templates.find((t) => t.id === selectedTemplate);

    if (!template) {
      alert('Template not found');
      return;
    }

    const completionText = template.template.replace('{text}', text);

    setIsThinking(true);

    var inferenceParams = '';

    if (experimentInfo?.config?.inferenceParams) {
      inferenceParams = experimentInfo?.config?.inferenceParams;
      inferenceParams = JSON.parse(inferenceParams);
    }

    console.log(inferenceParams);

    const generationParamsJSON = experimentInfo?.config?.generationParams;
    const generationParameters = JSON.parse(generationParamsJSON);

    const result = await chatAPI.sendCompletion(
      experimentInfo?.config?.foundation,
      experimentInfo?.config?.adaptor,
      completionText,
      generationParameters?.temperature,
      generationParameters?.maxTokens,
      generationParameters?.topP,
      false,
      generationParameters?.stop_str
    );
    setIsThinking(false);

    setCompletionOutput(result?.text);
  };

  return (
    <Sheet
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        paddingBottom: '10px',
        height: '100%',
        overflow: 'hidden',
        justifyContent: 'space-between',
        paddingTop: '1rem',
      }}
    >
      <div>
        <FormLabel>Prompt Template:</FormLabel>
        <Select
          placeholder="Select Template"
          variant="soft"
          name="template"
          value={selectedTemplate}
          onChange={(e, newValue) => {
            setSelectedTemplate(newValue);
            setCompletionOutput('');
          }}
          required
          sx={{ minWidth: 200, marginTop: '5px' }}
        >
          {templates.map((template) => (
            <Option key={template.id} value={template.id}>
              {template.title}
            </Option>
          ))}
        </Select>
      </div>
      {selectedTemplate && (
        <>
          <Typography
            level="body-xs"
            onClick={() => {
              setShowTemplate(!showTemplate);
            }}
            sx={{
              cursor: 'pointer',
              color: 'primary',
              textAlign: 'right',
            }}
          >
            {showTemplate ? 'Hide Template' : 'Show Template'}
          </Typography>
          {showTemplate && (
            <>
              <Sheet
                variant="plain"
                color="neutral"
                sx={{
                  padding: '0 1rem',
                  maxHeight: '400px',
                  // borderLeft: '2px solid var(--joy-palette-neutral-500)',
                  overflow: 'auto',
                }}
              >
                <Typography level="body-md" color="neutral">
                  <pre
                    style={{
                      whiteSpace: 'pre-wrap',
                      fontSize: '14px',
                      fontFamily: 'var(--joy-fontFamily-code)',
                    }}
                  >
                    {selectedTemplate
                      ? templates.find((t) => t.id === selectedTemplate)
                          .template
                      : ''}
                  </pre>
                </Typography>
              </Sheet>
            </>
          )}

          <Sheet
            variant="outlined"
            sx={{
              flex: 1,
              overflow: 'auto',
              padding: 2,
              margin: 'auto',
              flexDirection: 'column',
              width: '100%',
            }}
          >
            <Textarea
              placeholder=""
              variant="plain"
              name="completion-text"
              minRows={20}
              sx={{
                flex: 1,
                height: '100%',
                '--Textarea-focusedHighlight': 'rgba(13,110,253,0)',
              }}
            />
          </Sheet>
          <Button
            sx={{ ml: 'auto' }}
            color="neutral"
            endDecorator={
              isThinking ? (
                <CircularProgress
                  thickness={2}
                  size="sm"
                  color="neutral"
                  sx={{
                    '--CircularProgress-size': '13px',
                  }}
                />
              ) : (
                <SendIcon />
              )
            }
            disabled={isThinking}
            id="chat-submit-button"
            onClick={() =>
              sendTemplatedCompletionToLLM(
                document.getElementsByName('completion-text')?.[0]
              )
            }
          >
            {isThinking ? 'Answering' : 'Answer'}
          </Button>
          <Sheet
            variant="plain"
            sx={{
              padding: '2rem 1rem',
              flex: 3,
            }}
            id="completion-output"
          >
            <Box
              sx={{
                paddingLeft: 2,
                borderLeft: '2px solid var(--joy-palette-neutral-500)',
              }}
            >
              <Markdown
                remarkPlugins={[remarkGfm]}
                className="editableSheetContent"
              >
                {completionOutput}
              </Markdown>
            </Box>
          </Sheet>
        </>
      )}
    </Sheet>
  );
}
