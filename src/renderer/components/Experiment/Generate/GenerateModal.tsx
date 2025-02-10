import { useState, FormEvent, useEffect } from 'react';
import useSWR from 'swr';

import * as chatAPI from 'renderer/lib/transformerlab-api-sdk';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  Input,
  Modal,
  ModalDialog,
  Stack,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Sheet,
  Textarea,
} from '@mui/joy';
import DynamicPluginForm from '../DynamicPluginForm';
import TrainingModalDataTab from '../Train/TraningModalDataTab';
import PickADocumentMenu from '../Rag/PickADocumentMenu';

import { generateFriendlyName } from 'renderer/lib/utils';
import exp from 'node:constants';
const fetcher = (url) => fetch(url).then((res) => res.json());

function PluginIntroduction({ experimentInfo, pluginId }) {
  const { data, error, isLoading } = useSWR(
    chatAPI.Endpoints.Experiment.ScriptGetFile(
      experimentInfo?.id,
      pluginId,
      'info.md'
    ),
    fetcher
  );

  return (
    <>
      <Markdown remarkPlugins={[remarkGfm]} className="editableSheetContent">
        {data && data != 'FILE NOT FOUND'
          ? data
          : 'No description for this plugin is availabe.'}
      </Markdown>
    </>
  );
}

export default function GenerateModal({
  open,
  onClose,
  experimentInfo,
  experimentInfoMutate,
  pluginId,
  currentEvalName,
}: {
  open: boolean;
  onClose: () => void;
  experimentInfo: any;
  experimentInfoMutate: () => void;
  template_id?: string;
  pluginId: string;
  currentEvalName?: string; // Optional incase of new evaluation
}) {
  // Store the current selected Dataset in this modal
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [config, setConfig] = useState({});
  const [hasDatasetKey, setHasDatasetKey] = useState(false);
  const [hasDocumentsKey, setHasDocumentsKey] = useState(false);
  const [hasContextKey, setHasContextKey] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [selectedFileNames, setSelectedFileNames] = useState<string[]>([]);
  const [nameInput, setNameInput] = useState('');
  const [currentTab, setCurrentTab] = useState(0);
  const [contextInput, setContextInput] = useState('');
  const [datasetDisplayMessage, setDatasetDisplayMessage] = useState('');


  // Fetch available datasets from the API
  const {
    data: datasets,
    error: datasetsError,
    isLoading: datasetsIsLoading,
  } = useSWR(chatAPI.Endpoints.Dataset.LocalList(), fetcher);

  const { data, error, isLoading, mutate } = useSWR(
    experimentInfo?.id &&
      pluginId &&
      chatAPI.Endpoints.Experiment.ScriptGetFile(
        experimentInfo?.id,
        pluginId,
        'index.json'
      ),
    fetcher
  );

  const { data: currentDatasetInfo, isLoading: currentDatasetInfoIsLoading } =
    useSWR(() => {
      if (selectedDataset === null) {
        return null;
      }
      return chatAPI.Endpoints.Dataset.Info(selectedDataset);
    }, fetcher);

  // useEffect(() => {
  //   if (open) { // Reset the name input when the modal is opened
  //     setNameInput(generateFriendlyName());
  //   }}, []);

  useEffect(() => {
    if (open) {
      setSelectedFiles([]);
      setSelectedFileNames([]);
      if (!currentEvalName || currentEvalName === '') {
        setNameInput(generateFriendlyName());

      }
    }
  }, [open]);

  useEffect(() => {
    if (experimentInfo && pluginId) {
      if (currentEvalName && currentEvalName !== '') {
        const evaluationsStr = experimentInfo.config?.generations;
        if (typeof evaluationsStr === 'string') {
          try {
            const evaluations = JSON.parse(evaluationsStr);
            if (Array.isArray(evaluations)) {
              const evalConfig = evaluations.find(
                (evalItem: any) =>
                  evalItem.name === currentEvalName &&
                  evalItem.plugin === pluginId
              );
              if (evalConfig) {
                setConfig(evalConfig.script_parameters);
                const datasetKeyExists = Object.keys(
                  evalConfig.script_parameters
                ).some((key) => key.toLowerCase().includes('dataset'));
                const docsKeyExists = Object.keys(
                  evalConfig.script_parameters
                ).some((key) => key.toLowerCase().includes('docs'));
                const contextKeyExists = Object.keys(
                  evalConfig.script_parameters
                ).some((key) => key.toLowerCase().includes('context'));

                setHasDatasetKey(datasetKeyExists);
                setHasDocumentsKey(docsKeyExists);
                setHasContextKey(contextKeyExists);

                if (docsKeyExists && evalConfig.script_parameters.docs.length > 0) {
                  // const docstemp = evalConfig.script_parameters.docs.split(',').map((path) => ({ path }));
                  const docPaths = evalConfig.script_parameters.docs.split(',');
                  const docNames = evalConfig.script_parameters.doc_names.split(',');
                  // const docFiles = docPaths.map((path) => new File([], path));
                  setSelectedFiles(docPaths);
                  setSelectedFileNames(docNames);
                  delete evalConfig.script_parameters.docs;
                  setConfig(evalConfig.script_parameters)

                }
                else if (contextKeyExists && evalConfig.script_parameters.context.length > 0) {
                  const context = evalConfig.script_parameters.context;
                  setContextInput(context);
                  delete evalConfig.script_parameters.context;
                  setConfig(evalConfig.script_parameters)
                }
                if (
                  evalConfig.script_parameters._dataset_display_message &&
                  evalConfig.script_parameters._dataset_display_message.length >
                    0
                ) {
                  setDatasetDisplayMessage(
                    evalConfig.script_parameters._dataset_display_message
                  );
                }
              }
              setNameInput(evalConfig?.name);
              if (!nameInput && evalConfig?.script_parameters.run_name) {
                setNameInput(evalConfig.script_parameters.run_name);
              }
            }
          } catch (error) {
            console.error('Failed to parse evaluations JSON string:', error);
          }
        }
      } else {

        if (data) {
          let parsedData;
          try {
            parsedData = JSON.parse(data); //Parsing data for easy access to parameters}
            // Set config as a JSON object with keys of the parameters and values of the default values
            let tempconfig: { [key: string]: any } = {};
            if (parsedData && parsedData.parameters) {
              tempconfig = Object.fromEntries(
                Object.entries(parsedData.parameters).map(([key, value]) => [
                  key,
                  value.default,
                ])
              );
              if (parsedData && parsedData.dataset) {
                setHasDatasetKey(true);
                // Check if the dataset display message string length is greater than 0
                if (
                  parsedData._dataset_display_message &&
                  parsedData._dataset_display_message.length > 0
                ) {
                  setDatasetDisplayMessage(parsedData._dataset_display_message);
                  // Add dataset display message to the config parameters
                }
              }
              // Check if parsed data parameters has a key that includes 'docs'
              if (parsedData && parsedData.parameters) {
                const docsKeyExists = Object.keys(parsedData.parameters).some(
                  (key) => key.toLowerCase().includes('tflabcustomui_docs')
                );
                if (docsKeyExists) {
                  // Delete the parameter key that includes 'docs' from the config
                  delete tempconfig[Object.keys(parsedData.parameters).find((key) => key.toLowerCase().includes('tflabcustomui_docs'))];
                }
                const contextKeyExists = Object.keys(parsedData.parameters).some(
                  (key) => key.toLowerCase().includes('tflabcustomui_context')
                );
                if (contextKeyExists) {
                  // Delete the parameter key that includes 'context' from the config
                  delete tempconfig[Object.keys(parsedData.parameters).find((key) => key.toLowerCase().includes('tflabcustomui_context'))];
                }
                setHasContextKey(contextKeyExists);
                setHasDocumentsKey(docsKeyExists);
              }
            }
            setConfig(tempconfig);
            // Set hasDataset to true in the parsed data, the dataset key is `true`
            // If tempconfig is not an empty object
            // if (tempconfig && Object.keys(tempconfig).length > 0) {
            //   setNameInput(generateFriendlyName());
            // }
          } catch (e) {
            console.error('Error parsing data', e);
            parsedData = '';
          }
        }
      }
    }
  }, [experimentInfo, pluginId, currentEvalName, nameInput, data]);

  if (!experimentInfo?.id) {
    return 'Select an Experiment';
  }

  const currentModel = experimentInfo?.config?.foundation_filename
    ? experimentInfo?.config?.foundation_filename
    : experimentInfo?.config?.foundation;

  // Set config to the plugin config if it is available based on currentEvalName within experiment info

  function TrainingModalFirstTab() {
    return (
      <Stack spacing={2}>
        <FormControl>
          <FormLabel>Generation Task Name</FormLabel>
          <Input
            required
            autoFocus
            value={nameInput} //Value needs to be stored in a state variable otherwise it will not update on change/update
            onChange={(e) => setNameInput(e.target.value)}
            name="template_name"
            size="lg"
          />
          <FormHelperText>
            Give this specific generation recipe a unique name
          </FormHelperText>
        </FormControl>
        <FormLabel>Info</FormLabel>
        <Sheet color="neutral" variant="soft">
          <Stack direction="column" justifyContent="space-evenly" gap={2} p={2}>
            <FormControl sx={{ flex: 1 }}>
              <FormLabel>Plugin:</FormLabel>
              <Input
                readOnly
                value={pluginId}
                variant="soft"
                name="plugin_name"
              />
            </FormControl>
            <input hidden value={currentModel} name="model_name" readOnly />
            <input
              hidden
              value={experimentInfo?.config?.foundation_model_architecture}
              name="model_architecture"
              readOnly
            />
          </Stack>
        </Sheet>
      </Stack>
    );
  }

  // function DocsTab() {
  //   const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
  //     if (event.target.files) {
  //       setSelectedFiles(Array.from(event.target.files));
  //     }
  //   };

  //   return (
  //     <Stack spacing={2}>
  //       <FormControl>
  //         <FormLabel>Upload Documents</FormLabel>
  //         <Input
  //           type="file"
  //           multiple={true}
  //           onChange={handleFileChange}
  //           name="docs"
  //         />
  //         <FormHelperText>
  //           Select multiple documents to upload
  //         </FormHelperText>
  //       </FormControl>
  //       {selectedFiles.length > 0 && (
  //         <Stack spacing={1} mt={2}>
  //           <FormLabel>Selected Documents:</FormLabel>
  //           {selectedFiles.map((file, index) => (
  //             <Sheet key={index} variant="outlined" p={1}>
  //               {file.name}
  //             </Sheet>
  //           ))}
  //         </Stack>
  //       )}
  //     </Stack>
  //   );
  // }

  function DocsTab({ experimentInfo }) {

    return (
      <Stack spacing={2}>
        <FormControl>
          <FormLabel>Pick Documents</FormLabel>
          <PickADocumentMenu
            experimentInfo={experimentInfo}
            showFoldersOnly={false}
            setSelectedFiles={setSelectedFiles}
            setSelectedFileNames={setSelectedFileNames}
          />
          <FormHelperText>Select documents to upload</FormHelperText>
        </FormControl>
        {selectedFileNames.length > 0 && (
        <Stack spacing={1} mt={2}>
          <FormLabel>Selected Documents:</FormLabel>
          {selectedFileNames.map((file, index) => (
            <Sheet key={index} variant="outlined" p={1}>
              {file}
            </Sheet>
          ))}
        </Stack>
      )}
      </Stack>
    );
  }




  function ContextTab({contextInput, setContextInput}) {

    return (
      <Stack spacing={2}>
        <FormControl>
          <FormLabel>Context</FormLabel>
          <Textarea
            minRows={5}
            value={contextInput}
            onChange={(e) => setContextInput(e.target.value)}
            name="context"
            style={{ width: '100%' }}
          />
          <FormHelperText>
            Provide context for the generation task
          </FormHelperText>
        </FormControl>
      </Stack>
    );
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const formJson = Object.fromEntries((formData as any).entries());
    // Add an extra field in formJson for datasetDisplayMessage
    if (datasetDisplayMessage.length > 0) {
      formJson._dataset_display_message = datasetDisplayMessage;
    }
    try {
      if (!formJson.run_name) {
        formJson.run_name = formJson.template_name;
      }
      // Add the selected file paths to the formJson as comma separated string
      // if (hasDocumentsKey && selectedFiles.length > 0) {
      //   formJson.docs = selectedFiles.map((file) => file.path).join(',');
      //   formJson.generation_type = 'docs';
      // }
      if (hasDocumentsKey && selectedFiles.length > 0) {
        formJson.docs = selectedFiles.join(',');;
        formJson.doc_names = selectedFileNames.join(',');
        formJson.generation_type = 'docs';
      }
      // Add context to the formJson
      else if (hasContextKey && contextInput.length > 0) {
        formJson.context = contextInput;
        formJson.generation_type = 'context';
      }
      else {
        formJson.generation_type = 'scratch';
      }

      console.log("EDITED FORM JSON", formJson);

      // Run when the currentEvalName is provided
      if (currentEvalName && currentEvalName !== '') {
        const result = await chatAPI.EXPERIMENT_EDIT_GENERATION(
          experimentInfo?.id,
          currentEvalName,
          formJson
        );
        setNameInput(generateFriendlyName());
        setContextInput('');
        setSelectedFiles([]);
        setSelectedFileNames([]);
      } else {
        const template_name = formJson.template_name;
        delete formJson.template_name;
        console.log('formJson', formJson);
        console.log("experimentInfo?.id", experimentInfo?.id);
        console.log("template_name", template_name);
        console.log("pluginId", pluginId);
        const result = await chatAPI.EXPERIMENT_ADD_GENERATION(
          experimentInfo?.id,
          template_name,
          pluginId,
          formJson
        );
        // alert(JSON.stringify(formJson, null, 2));
        setNameInput(generateFriendlyName());
      }
      experimentInfoMutate();
      onClose();

      // };
      // }
      // const result = await chatAPI.EXPERIMENT_EDIT_EVALUATION(experimentInfo?.id, currentEvalName, formJson)
      // // alert(JSON.stringify(formJson, null, 2));
      // setNameInput(generateFriendlyName());
      // onClose();
    } catch (error) {
      console.error('Failed to edit generation:', error);
    }
  };

  return (
    <Modal open={open}>
      <ModalDialog
        sx={{
          width: '80dvw',
          transform: 'translateX(-50%)', // This undoes the default translateY that centers vertically
          top: '5dvh',
          overflow: 'auto',
          maxHeight: '90dvh',
          minHeight: '70dvh',
          height: '100%',
        }}
      >
        <form
          id="evaluation-form"
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            justifyContent: 'space-between',
          }}
          onSubmit={handleSubmit}
        >
          <Tabs
            aria-label="evaluation Template Tabs"
            value={currentTab}
            onChange={(event, newValue) => setCurrentTab(newValue)}
            sx={{ borderRadius: 'lg', display: 'flex', overflow: 'hidden' }}
          >
            <TabList>
              <Tab>Introduction</Tab>
              <Tab>Name</Tab>
              <Tab>Plugin Config</Tab>
              {hasDocumentsKey && <Tab>Documents</Tab>}
              {hasContextKey && <Tab>Context</Tab>}
              {hasDatasetKey && <Tab>Dataset</Tab>}
            </TabList>
            <TabPanel value={0} sx={{ p: 2, overflow: 'auto' }}>
              <PluginIntroduction
                experimentInfo={experimentInfo}
                pluginId={pluginId}
              />
            </TabPanel>
            <TabPanel value={1} sx={{ p: 2, overflow: 'auto' }} keepMounted>
              <TrainingModalFirstTab />
            </TabPanel>
            <TabPanel value={2} sx={{ p: 2, overflow: 'auto' }} keepMounted>
              <DynamicPluginForm
                experimentInfo={experimentInfo}
                plugin={pluginId}
                config={config}
              />
            </TabPanel>
            {hasDocumentsKey && (
              <TabPanel value={3} sx={{ p: 2, overflow: 'auto' }} keepMounted>
                <DocsTab
                experimentInfo={experimentInfo}
                />
                {/* <PickADocumentMenu
                  experimentInfo={experimentInfo}
                  /> */}
              </TabPanel>
              // <DocsTab />
            )}
            {hasContextKey && (
              <TabPanel value={3} sx={{ p: 2, overflow: 'auto' }} keepMounted>
                <ContextTab contextInput={contextInput} setContextInput={setContextInput} />
              </TabPanel>
            )}
            {hasDatasetKey && (
              <TabPanel value={4} sx={{ p: 2, overflow: 'auto' }} keepMounted>
                <>
                  <TrainingModalDataTab
                    datasetsIsLoading={datasetsIsLoading}
                    datasets={datasets}
                    selectedDataset={selectedDataset}
                    setSelectedDataset={setSelectedDataset}
                    currentDatasetInfoIsLoading={currentDatasetInfoIsLoading}
                    currentDatasetInfo={currentDatasetInfo}
                    templateData={null}
                    injectIntoTemplate={null}
                    experimentInfo={experimentInfo}
                    pluginId={pluginId}
                    displayMessage={datasetDisplayMessage}
                  />
                </>
              </TabPanel>
            )}
          </Tabs>
          <Stack spacing={2} direction="row" justifyContent="flex-end">
            <Button color="danger" variant="soft" onClick={() => onClose()}>
              Cancel
            </Button>
            <Button variant="soft" type="submit" color="success">
              Save Generation Task
            </Button>
          </Stack>
        </form>
        {/* {JSON.stringify(config, null, 2)} */}
      </ModalDialog>
    </Modal>
  );
}
