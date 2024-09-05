/* eslint-disable jsx-a11y/anchor-is-valid */
import * as React from 'react';
import useSWR from 'swr';

import {
  Sheet,
  FormControl,
  FormLabel,
  Button,
  Typography,
  Radio,
  RadioGroup,
  Box,
  Alert,
} from '@mui/joy';

import ChatPage from './ChatPage';

import * as chatAPI from '../../../lib/transformerlab-api-sdk';

import './styles.css';

import { useDebounce } from 'use-debounce';
import CompletionsPage from './CompletionsPage';
import PromptSettingsModal from './PromptSettingsModal';
import MainGenerationConfigKnobs from './MainGenerationConfigKnobs';
import { FaEllipsisVertical } from 'react-icons/fa6';
import Rag from '../Rag';
import PreviousMessageList from './PreviousMessageList';
import TemplatedCompletion from './TemplatedCompletion';

function scrollChatToBottom() {
  // We animate it twice, the second time to accomodate the scale up transition
  // I find this looks better than one later scroll
  setTimeout(() => document.getElementById('endofchat')?.scrollIntoView(), 100);
  setTimeout(() => document.getElementById('endofchat')?.scrollIntoView(), 400);
}

// Get the System Message from the backend.
// Returns "" if there was an error.
async function getAgentSystemMessage() {
  const prompt = await fetch(
    chatAPI.Endpoints.Tools.Prompt()
  ).then(
    (res) => res.json()
  ).catch(
    // TODO: Retry? Post error message?
    // For now just returning arbitrary system message.
    (error) => "You are a helpful chatbot assistant."
  );
  console.log(prompt);
  return prompt;
}

/**
 * callTool - calls the Tools API and returns the result
 * TODO: Wrap all of the comms code in here and move to the SDK?
 *
 * @param function_name String with name of tool to call
 * @param arguments Object with named arguments to be passed to tool
 * @returns A JSON object with fields status, error and data.
 */
async function callTool(function_name: String, function_args: Object = {}) {
  const arg_string = JSON.stringify(function_args);
  console.log(`Calling Function: ${function_name}`);
  console.log(`with arguments ${arg_string}`);

  const response = await fetch(
    chatAPI.Endpoints.Tools.Call(
      function_name,
      function_args
    )
  );
  const result = await response.json();
  console.log(result);
  return result;
}


function shortenArray(arr, maxLen) {
  if (!arr) return [];
  if (arr.length <= maxLen) {
    return arr;
  }
  return arr.slice(0, maxLen - 1).concat('...');
}

const fetcher = (url) => fetch(url).then((res) => res.json());

export default function Chat({
  experimentInfo,
  experimentInfoMutate,
  setRagEngine,
}) {
  const { models, isError, isLoading } = chatAPI.useModelStatus();
  const [mode, setMode] = React.useState('chat');
  const [conversationId, setConversationId] = React.useState(null);
  const [chats, setChats] = React.useState([]);
  const [isThinking, setIsThinking] = React.useState(false);
  const [generationParameters, setGenerationParameters] = React.useState({
    temperature: 0.7,
    maxTokens: 1024,
    topP: 1.0,
    frequencyPenalty: 0.0,
    needsReset: true,
  });
  const [showPromptSettingsModal, setShowPromptSettingsModal] =
    React.useState(false);

  const [text, setText] = React.useState('');

  const { data: defaultPromptConfigForModel } = useSWR(
    chatAPI.TEMPLATE_FOR_MODEL_URL(experimentInfo?.config?.foundation),
    fetcher
  );

  const parsedPromptData = experimentInfo?.config?.prompt_template;

  var textToDebounce = '';

  // The following code, when in chat mode, will try to create a fake string
  // that roughly represents the chat as a long prompt. But this is a hack:
  // If we really want count tokens accurately, we need to pass the system
  // message and messages to the server and let it format the prompt as per
  // the moel's template. More info here: https://huggingface.co/docs/transformers/main/en/chat_templating
  // For now this is helpful a rough indicator of the number of tokens used.
  // But we should improve this later
  if (mode === 'chat' || mode == 'agent') {
    textToDebounce += experimentInfo?.config?.prompt_template?.system_message;
    textToDebounce += '\n';
    chats.forEach((c) => {
      textToDebounce += c.t;
    });
  } else {
    textToDebounce = text;
  }

  const [debouncedText] = useDebounce(textToDebounce, 1000);

  const [tokenCount, setTokenCount] = React.useState({});
  const currentModel = experimentInfo?.config?.foundation;
  //This is necessary for assessing whether a model is multimodal or not, and whether images can be sent
  const currentModelArchitecture =
    experimentInfo?.config?.foundation_model_architecture;
  const adaptor = experimentInfo?.config?.adaptor;

  React.useEffect(() => {
    if (debouncedText) {
      if (mode === 'chat') {
        countChatTokens();
      } else {
        countTokens();
      }
    }
  }, [debouncedText]);

  // If the model changes, check the location of the inference service
  // And reset the global pointer to the inference server
  React.useEffect(() => {
    if (!window.TransformerLab) {
      window.TransformerLab = {};
    }
    if (models?.[0]?.location) {
      window.TransformerLab.inferenceServerURL = models?.[0]?.location;
    } else {
      window.TransformerLab.inferenceServerURL = null;
    }
  }, [models]);

  React.useMemo(() => {
    const asyncTasks = async () => {
      const result = await chatAPI.getTemplateForModel(currentModel);
      const t = result?.system_message;

      const parsedPromptData =
        experimentInfo?.config?.prompt_template?.system_message;

      if (parsedPromptData && document.getElementsByName('system-message')[0]) {
        document.getElementsByName('system-message')[0].value =
          parsedPromptData;
      } else if (t) {
        if (document.getElementsByName('system-message')[0])
          document.getElementsByName('system-message')[0].value = t;
      } else {
        if (document.getElementsByName('system-message')[0]) {
          document.getElementsByName('system-message')[0].value = '';
        }
      }

      const startingChats = [];

      result?.messages.forEach((m) => {
        if (m[0] === 'Human') {
          startingChats.push({ t: m[1], user: 'human', key: Math.random() });
        } else {
          startingChats.push({ t: m[1], user: 'bot', key: Math.random() });
        }
      });

      // We will ignore the FastChat starting chats for now. If you uncomment
      // the following line, you will see a starting conversation.
      //setChats(startingChats);

      scrollChatToBottom();
    };

    if (!currentModel) return;

    asyncTasks();
  }, [currentModel, adaptor, experimentInfo?.config?.prompt_template]);

  React.useEffect(() => {
    if (generationParameters?.needsReset) {
      // Get the generation parameters from the experiment config
      var generationParams = experimentInfo?.config?.generationParams;
      if (generationParams) {
        try {
          generationParams = JSON.parse(generationParams);
        } catch (e) {
          generationParams = {};
          console.log('Error parsing generation parameters as JSON');
        }
        setGenerationParameters(generationParams);
      } else {
        // If they don't exist, set them to some defaults
        setGenerationParameters({
          temperature: 0.7,
          maxTokens: 1024,
          topP: 1.0,
          frequencyPenalty: 0.0,
          needsReset: false,
        });
      }
    } else {
      fetch(
        chatAPI.Endpoints.Experiment.UpdateConfig(
          experimentInfo?.id,
          'generationParams',
          JSON.stringify(generationParameters)
        )
      ).then(() => {
        experimentInfoMutate();
      });
    }
  }, [generationParameters]);

  function stopStreaming() {
    chatAPI.stopStreamingResponse();
  }

  /////////////////////////////////////////////
  //FUNCTIONS USED BY BOTH CHAT AND AGENT PANES
  /////////////////////////////////////////////

  // Call this function to add a new chat to the chats array and scroll the UI.
  // Since setChats won't update chats until after this render
  // this also returns an updated array you can work with before next render
  function addChat(newChat: object) {
    const newChats = [...chats, newChat];

    // Add Message to Chat Array:
    setChats(newChats);
    scrollChatToBottom();

    return newChats;
  }

  function addUserChat(text: String, image?: string) {
    // Generate a random key for this message
    const r = Math.floor(Math.random() * 1000000);

    return addChat({
      t: text,
      user: 'human',
      key: r,
      image: image
    });
  }

  function addToolResult(result: object) {
    const r = Math.floor(Math.random() * 1000000);
    return {
      t: result,
      user: 'tool',
      key: r
    }
  }

  async function addAssistantChat(result: object) {
    let numberOfTokens = await chatAPI.countTokens(currentModel, [
      result?.text,
    ]);
    numberOfTokens = numberOfTokens?.tokenCount;
    console.log('Number of Tokens: ', numberOfTokens);
    console.log(result);
    const timeToFirstToken = result?.timeToFirstToken;
    const tokensPerSecond = (numberOfTokens / parseFloat(result?.time)) * 1000;

    return {
      t: result?.text,
      user: 'bot',
      key: result?.id,
      numberOfTokens: numberOfTokens,
      timeToFirstToken: timeToFirstToken,
      tokensPerSecond: tokensPerSecond,
    }
  }

  // This returns the Chats list in the format that the LLM is expecting
  function getChatsInLLMFormat() {
    return chats.map((c) => {
      return {
        role: c.user === 'bot' ? 'assistant' : 'user',
        content: c.t ? c.t : '',
      };
    });
  }

  const sendNewMessageToLLM = async (text: String, image?: string) => {

    // Add new user message to chat history
    var newChats = addUserChat(text, image);

    const timeoutId = setTimeout(() => {
      setIsThinking(true);
      scrollChatToBottom();
    }, 100);

    const systemMessage =
      document.getElementsByName('system-message')[0]?.value;

    // Get a list of all the existing chats so we can send them to the LLM
    let texts = getChatsInLLMFormat();

    // Add the user's message
    if (image && image !== '') {
      //Images must be sent in this format for fastchat
      texts.push({
        role: 'user',
        content: [
          { type: 'text', text: text },
          { type: 'image_url', image_url: image },
        ],
      });
      //texts.push({ role: 'user', content: { image } });
    } else {
      texts.push({ role: 'user', content: text });
    }

    const generationParamsJSON = experimentInfo?.config?.generationParams;
    const generationParameters = JSON.parse(generationParamsJSON);

    try {
      generationParameters.stop_str = JSON.parse(
        generationParameters?.stop_str
      );
    } catch (e) {
      console.log('Error parsing stop strings as JSON');
    }

    // Send them over
    const result = await chatAPI.sendAndReceiveStreaming(
      currentModel,
      adaptor,
      texts,
      generationParameters?.temperature,
      generationParameters?.maxTokens,
      generationParameters?.topP,
      generationParameters?.frequencyPenalty,
      systemMessage,
      generationParameters?.stop_str,
      image
    );

    clearTimeout(timeoutId);
    setIsThinking(false);
    // Add Response to Chat Array:

    let numberOfTokens = await chatAPI.countTokens(currentModel, [
      result?.text,
    ]);
    numberOfTokens = numberOfTokens?.tokenCount;
    console.log('Number of Tokens: ', numberOfTokens);
    console.log(result);
    const timeToFirstToken = result?.timeToFirstToken;
    const tokensPerSecond = (numberOfTokens / parseFloat(result?.time)) * 1000;

    newChats = [...newChats, {
      t: result?.text,
      user: 'bot',
      key: result?.id,
      numberOfTokens: numberOfTokens,
      timeToFirstToken: timeToFirstToken,
      tokensPerSecond: tokensPerSecond,
    }];

    setChats(newChats);

    // If this is a new conversation, generate a new conversation Id
    var cid = conversationId;
    const experimentId = experimentInfo?.id;

    if (cid == null) {
      cid = Math.random().toString(36).substring(7);
      setConversationId(cid);
    }

    //save the conversation to the server
    fetch(chatAPI.Endpoints.Experiment.SaveConversation(experimentId), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversation_id: cid,
        conversation: JSON.stringify(newChats),
      }),
    }).then((response) => {
      conversationsMutate();
    });

    scrollChatToBottom();

    return result?.text;
  };

  /**
   * getToolCallsFromLLMResponse
   *
   * Returns an array of tool call JSON objects.
   * Throws an exception if any tool call is not formatted correctly
   */
  function getToolCallsFromLLMResponse(llm_response: String) {
    let tool_calls: any[] = [];

    if (!llm_response) return tool_calls;

    let start = 0;
    let end = -1;
    const START_TAG = "<tool_call>";
    const END_TAG = "</tool_call>";

    while (start >= 0) {
      // first search for start tag
      start = llm_response.indexOf(START_TAG, start);
      if (start == -1) break;  // no start tags found

      // Move the start marker after the tag and search for close tag
      start += START_TAG.length;
      end = llm_response.indexOf(END_TAG, start);
      const tool_string = end == -1
                    ? llm_response.substring(start)
                    : llm_response.substring(start, end);

      // Decode the JSON string
      const tool_call = JSON.parse(tool_string);
      tool_calls.push(tool_call);

      if (end == -1) break;  // no more text to search
      start = end+END_TAG.length; // continue search after end tag
    }

    return tool_calls;
  }

  const sendNewMessageToAgent = async (text: String, image?: string) => {

    // Add new user message to chat history
    var newChats = addUserChat(text, image);

    const timeoutId = setTimeout(() => {
      setIsThinking(true);
      scrollChatToBottom();
    }, 100);

    const systemMessage = await getAgentSystemMessage();

    // Get a list of all the existing chats so we can send them to the LLM
    let texts = getChatsInLLMFormat();

    // Add the user's message
    if (image && image !== '') {
      //Images must be sent in this format for fastchat
      texts.push({
        role: 'user',
        content: [
          { type: 'text', text: text },
          { type: 'image_url', image_url: image },
        ],
      });
      //texts.push({ role: 'user', content: { image } });
    } else {
      texts.push({ role: 'user', content: text });
    }
    console.log(texts);

    const generationParamsJSON = experimentInfo?.config?.generationParams;
    const generationParameters = JSON.parse(generationParamsJSON);

    try {
      generationParameters.stop_str = JSON.parse(
        generationParameters?.stop_str
      );
    } catch (e) {
      console.log('Error parsing stop strings as JSON');
    }

    // Send them over
    let result = await chatAPI.sendAndReceiveStreaming(
      currentModel,
      adaptor,
      texts,
      generationParameters?.temperature,
      generationParameters?.maxTokens,
      generationParameters?.topP,
      generationParameters?.frequencyPenalty,
      systemMessage,
      generationParameters?.stop_str,
      image
    );

    // Before we return to the user, check to see if the LLM is trying to call a function
    // Tool calls should be contained between a <tool_call> tag
    // and either a close tag or the end of the string
    const llm_response = result?.text;

    if (llm_response && llm_response.includes("<tool_call>")) {
      const tool_calls = getToolCallsFromLLMResponse(llm_response);

      // if there are any tool calls in the LLM response then
      // we have to call the Tools API and send back responses to the LLM
      if (Array.isArray(tool_calls) && tool_calls.length) {

        // first push the assistant's original response on to the chat lists
        texts.push({ role: 'assistant', content: llm_response });
        newChats = [...newChats, await addAssistantChat(result)];
        setChats(newChats);

        // iterate through tool_calls (there can be more than one)
        // and actually call the tools and save responses
        let tool_responses = [];
        for(const tool_call of tool_calls) {
          const func_name = tool_call.name;
          const func_args = tool_call.arguments;
          const func_response = await callTool(func_name, func_args);

          // If this was successful then respond with the results
          if (func_response.status && func_response.status != "error" && func_response.data) {
            tool_responses.push(func_response.data);

          // Otherwise, report an error to the LLM!
          } else {
            if (func_response.message) {
              tool_responses.push(func_response.message);
            } else {
              tool_responses.push("There was an unknown error calling the tool.");
            }
          }
        }

        // Add all function output as response to conversation
        // How to format response if there are multiple calls?
        // For now just put a newline between them.
        let tool_response = tool_responses.join("\n");

        // TODO: role should be 'tool' not 'user'
        // ...but tool is not supported by backend right now?
        texts.push({ role: 'user', content: tool_response });
        newChats = [...newChats, addToolResult(tool_response)];
        setChats(newChats);

        // Call the model AGAIN with the tool response
        // Update result with the new response
        result = await chatAPI.sendAndReceiveStreaming(
          currentModel,
          adaptor,
          texts,
          generationParameters?.temperature,
          generationParameters?.maxTokens,
          generationParameters?.topP,
          generationParameters?.frequencyPenalty,
          systemMessage,
          generationParameters?.stop_str,
          image
        );
      }
    }

    clearTimeout(timeoutId);
    setIsThinking(false);

    // Add Response to Chat Array:
    let numberOfTokens = await chatAPI.countTokens(currentModel, [
      result?.text,
    ]);
    numberOfTokens = numberOfTokens?.tokenCount;
    console.log('Number of Tokens: ', numberOfTokens);
    console.log(result);
    const timeToFirstToken = result?.timeToFirstToken;
    const tokensPerSecond = (numberOfTokens / parseFloat(result?.time)) * 1000;

    newChats = [...newChats, {
      t: result?.text,
      user: 'bot',
      key: result?.id,
      numberOfTokens: numberOfTokens,
      timeToFirstToken: timeToFirstToken,
      tokensPerSecond: tokensPerSecond,
    }];

    setChats(newChats);

    // If this is a new conversation, generate a new conversation Id
    var cid = conversationId;
    const experimentId = experimentInfo?.id;

    if (cid == null) {
      cid = Math.random().toString(36).substring(7);
      setConversationId(cid);
    }

    //save the conversation to the server
    fetch(chatAPI.Endpoints.Experiment.SaveConversation(experimentId), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversation_id: cid,
        conversation: JSON.stringify(newChats),
      }),
    }).then((response) => {
      conversationsMutate();
    });

    scrollChatToBottom();

    return result?.text;
  };

  // Get all conversations for this experiment
  const {
    data: conversations,
    error: conversationsError,
    isLoading: conversationsIsLoading,
    mutate: conversationsMutate,
  } = useSWR(
    chatAPI.Endpoints.Experiment.GetConversations(experimentInfo?.id),
    fetcher
  );

  const sendCompletionToLLM = async (element, targetElement) => {
    const text = element.value;

    setIsThinking(true);

    var inferenceParams = '';

    if (experimentInfo?.config?.inferenceParams) {
      inferenceParams = experimentInfo?.config?.inferenceParams;
      inferenceParams = JSON.parse(inferenceParams);
    }

    const generationParamsJSON = experimentInfo?.config?.generationParams;
    const generationParameters = JSON.parse(generationParamsJSON);

    try {
      generationParameters.stop_str = JSON.parse(
        generationParameters?.stop_str
      );
    } catch (e) {
      console.log('Error parsing stop strings as JSON');
    }

    const result = await chatAPI.sendCompletion(
      currentModel,
      adaptor,
      text,
      generationParameters?.temperature,
      generationParameters?.maxTokens,
      generationParameters?.topP,
      false,
      generationParameters?.stop_str,
      targetElement
    );
    setIsThinking(false);

    // if (result?.text) element.value += result.text;
  };

  async function countTokens() {
    var count = await chatAPI.countTokens(currentModel, [debouncedText]);
    setTokenCount(count);
  }

  async function countChatTokens() {
    const systemMessage =
      document.getElementsByName('system-message')[0]?.value;

    let texts = chats.map((c) => {
      return {
        role: c.user === 'human' ? 'user' : 'assistant',
        content: c.t ? c.t : '',
      };
    });

    texts.push({ role: 'user', content: debouncedText });

    var count = await chatAPI.countChatTokens(currentModel, texts);

    setTokenCount(count);
  }

  if (!experimentInfo) return 'Select an Experiment';

  return (
    <>
      <Sheet
        id="interact-page"
        sx={{
          display: 'flex',
          height: '100%',
          paddingBottom: 1,
          flexDirection: 'row',
          gap: 3,
        }}
      >
        <Sheet
          sx={{
            position: 'absolute',
            top: '0%',
            left: '0%',
            height: '90dvh',
            width: '80dvw',
            zIndex: 10000,
            backgroundColor: 'var(--joy-palette-neutral-softBg)',
            opacity: 0.9,
            borderRadius: 'md',
            padding: 2,
            visibility: !models?.[0]?.id ? 'visible' : 'hidden',
          }}
        >
          <Alert
            sx={{ position: 'relative', top: '50%', justifyContent: 'center' }}
          >
            No Model is Running
          </Alert>
        </Sheet>
        <PromptSettingsModal
          open={showPromptSettingsModal}
          setOpen={setShowPromptSettingsModal}
          defaultPromptConfigForModel={defaultPromptConfigForModel}
          generationParameters={generationParameters}
          setGenerationParameters={setGenerationParameters}
          tokenCount={tokenCount}
          experimentInfo={experimentInfo}
          experimentInfoMutate={experimentInfoMutate}
        />
        {/* <pre>{JSON.stringify(chats, null, 2)}</pre> */}
        {mode === 'chat' && (
          <ChatPage
            key={conversationId}
            chats={chats}
            setChats={setChats}
            experimentInfo={experimentInfo}
            isThinking={isThinking}
            sendNewMessageToLLM={sendNewMessageToLLM}
            stopStreaming={stopStreaming}
            experimentInfoMutate={experimentInfoMutate}
            tokenCount={tokenCount}
            text={textToDebounce}
            debouncedText={debouncedText}
            defaultPromptConfigForModel={defaultPromptConfigForModel}
            currentModelArchitecture={currentModelArchitecture}
          />
        )}
        {mode === 'completion' && (
          <CompletionsPage
            text={text}
            setText={setText}
            debouncedText={debouncedText}
            tokenCount={tokenCount}
            isThinking={isThinking}
            sendCompletionToLLM={sendCompletionToLLM}
            stopStreaming={stopStreaming}
          />
        )}
        {mode === 'retrieval' && (
          <Rag experimentInfo={experimentInfo} setRagEngine={setRagEngine} />
        )}
        {mode === 'template' && (
          <TemplatedCompletion experimentInfo={experimentInfo} />
        )}
        {mode === 'agent' && (
          <ChatPage
            key={conversationId}
            chats={chats}
            setChats={setChats}
            experimentInfo={experimentInfo}
            isThinking={isThinking}
            sendNewMessageToLLM={sendNewMessageToAgent}
            stopStreaming={stopStreaming}
            experimentInfoMutate={experimentInfoMutate}
            tokenCount={tokenCount}
            text={textToDebounce}
            debouncedText={debouncedText}
            defaultPromptConfigForModel={defaultPromptConfigForModel}
            agentMode
            currentModelArchitecture={currentModelArchitecture}
          />
        )}
        <Box
          id="right-hand-panel-of-chat-page"
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            flex: '0 0 300px',
            justifyContent: 'space-between',
            overflow: 'hidden',
          }}
        >
          <Sheet
            id="chat-settings-on-right"
            variant="plain"
            sx={{
              // borderRadius: "md",
              display: 'flex',
              flexDirection: 'column',
              flex: '1 1 50%',
              xpadding: 2,
              justifyContent: 'flex-start',
              overflow: 'hidden',
              // border: '4px solid green',
            }}
          >
            <Typography level="h2" fontSize="lg" id="card-description" mb={3}>
              {currentModel} {adaptor && '- '}
              {adaptor}
            </Typography>
            <FormControl>
              <FormLabel sx={{ fontWeight: '600' }}>Mode:</FormLabel>
              <RadioGroup
                orientation="horizontal"
                aria-labelledby="segmented-controls-example"
                name="mode"
                value={mode}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  setMode(event.target.value)
                }
                size="sm"
                sx={{
                  minHeight: 48,
                  padding: '4px',
                  borderRadius: '12px',
                  bgcolor: 'neutral.softBg',
                  '--RadioGroup-gap': '4px',
                  '--Radio-actionRadius': '8px',
                  justifyContent: 'space-evenly',
                  '& .MuiRadio-root': {
                    padding: '0px',
                  },
                }}
              >
                {['chat', 'completion', 'template', 'agent' /*'retrieval', 'more'*/].map(
                  (item) => (
                    <Radio
                      key={item}
                      color="neutral"
                      value={item}
                      disableIcon
                      disabled={isThinking}
                      label={
                        item == 'more' ? (
                          <FaEllipsisVertical
                            size="12px"
                            style={{ marginBottom: '-1px' }}
                          />
                        ) : (
                          item
                        )
                      }
                      variant="plain"
                      sx={{
                        px: 2,
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexGrow: 1,
                      }}
                      slotProps={{
                        label: { style: { textAlign: 'center' } },
                        action: ({ checked }) => ({
                          sx: {
                            ...(checked && {
                              bgcolor: 'background.surface',
                              boxShadow: 'sm',
                              '&:hover': {
                                bgcolor: 'background.surface',
                              },
                            }),
                          },
                        }),
                      }}
                    />
                  )
                )}
              </RadioGroup>
            </FormControl>
            <Box sx={{ overflow: 'auto', width: '100%', padding: 3 }}>
              <FormControl>
                <MainGenerationConfigKnobs
                  generationParameters={generationParameters}
                  setGenerationParameters={setGenerationParameters}
                  tokenCount={tokenCount}
                  defaultPromptConfigForModel={defaultPromptConfigForModel}
                  showAllKnobs={false}
                />
                <Button
                  variant="soft"
                  onClick={() => {
                    setShowPromptSettingsModal(true);
                  }}
                >
                  All Generation Settings
                </Button>
              </FormControl>
            </Box>
          </Sheet>
          <PreviousMessageList
            conversations={conversations}
            conversationsIsLoading={conversationsIsLoading}
            conversationsMutate={conversationsMutate}
            setChats={setChats}
            setConversationId={setConversationId}
            conversationId={conversationId}
            experimentInfo={experimentInfo}
          />
        </Box>
      </Sheet>
    </>
  );
}
