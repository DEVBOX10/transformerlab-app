import {
  Box,
  Button,
  ButtonGroup,
  Divider,
  Dropdown,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemContent,
  ListItemDecorator,
  Menu,
  MenuButton,
  MenuItem,
  Sheet,
  Typography,
} from '@mui/joy';

import '@xyflow/react/dist/style.css';
import {
  AxeIcon,
  EllipsisIcon,
  Icon,
  PencilIcon,
  PenIcon,
  PlayIcon,
  PlusCircleIcon,
  PlusIcon,
  Trash2,
  Trash2Icon,
  WorkflowIcon,
} from 'lucide-react';
import { useState } from 'react';

import * as chatAPI from '../../../lib/transformerlab-api-sdk';
import useSWR from 'swr';
import NewWorkflowModal from './NewWorkflowModal';
import NewNodeModal from './NewNodeModal';
import WorkflowCanvas from './WorkflowCanvas';

const fetcher = (url: any) => fetch(url).then((res) => res.json());

export default function Workflows({ experimentInfo }) {
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(null);
  const [newWorkflowModalOpen, setNewWorkflowModalOpen] = useState(false);
  const [newNodeflowModalOpen, setNewNodeflowModalOpen] = useState(false);

  const {
    data: workflowsData,
    error: workflowsError,
    isLoading: isLoading,
    mutate: mutateWorkflows,
  } = useSWR(chatAPI.Endpoints.Workflows.List(), fetcher);

  const workflows = workflowsData;

  const selectedWorkflow = workflows?.find(
    (workflow) => workflow.id === selectedWorkflowId
  );

  async function runWorkflow(workflowId: string) {
    await fetch(chatAPI.Endpoints.Workflows.RunWorkflow(workflowId));
  }

  return (
    <Sheet
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        mb: 3,
      }}
    >
      <NewWorkflowModal
        open={newWorkflowModalOpen}
        onClose={() => {
          setNewWorkflowModalOpen(false);
          mutateWorkflows();
        }}
        experimentId={experimentInfo?.id}
      />
      {selectedWorkflow && (
        <NewNodeModal
          open={newNodeflowModalOpen}
          onClose={() => {
            setNewNodeflowModalOpen(false);
            mutateWorkflows();
          }}
          selectedWorkflow={selectedWorkflow}
          experimentInfo={experimentInfo}
        />
      )}
      <Typography level="h1">Workflows</Typography>
      <Typography level="body-lg" mb={3}>
        This is where it will all go
      </Typography>
      <Sheet
        sx={{
          display: 'flex',
          flexDirection: 'row',
          gap: 2,
          width: '100%',
          height: '100%',
        }}
      >
        <Box flex={1}>
          <Typography level="title-lg" mb={2}>
            Workflows
          </Typography>
          <List>
            {workflows &&
              workflows?.length > 0 &&
              workflows?.map((workflow) => (
                <ListItem key={workflow.id}>
                  <ListItemButton
                    onClick={() => setSelectedWorkflowId(workflow.id)}
                    selected={selectedWorkflowId === workflow.id}
                  >
                    <ListItemDecorator>
                      <WorkflowIcon />
                    </ListItemDecorator>
                    <ListItemContent>{workflow.name}</ListItemContent>
                  </ListItemButton>
                </ListItem>
              ))}
            <Divider />
            <ListItem>
              <ListItemButton onClick={() => setNewWorkflowModalOpen(true)}>
                <ListItemDecorator>
                  <PlusCircleIcon />
                </ListItemDecorator>
                <ListItemContent>New Workflow</ListItemContent>
              </ListItemButton>
            </ListItem>
          </List>
        </Box>

        <Box flex={3} display="flex" flexDirection="column">
          <Box
            display="flex"
            flexDirection="row"
            alignItems="center"
            mb={1}
            justifyContent="space-between"
          >
            <Typography level="title-lg">
              Workflow {selectedWorkflow?.name}
            </Typography>
            <Box pl={2} display="flex" flexDirection="row" gap={1}>
              {selectedWorkflow?.status != 'RUNNING' ? (
                <Button
                  startDecorator={<PlayIcon />}
                  onClick={() => runWorkflow(selectedWorkflow.id)}
                >
                  Run
                </Button>
              ) : (
                <Button startDecorator={<PlayIcon />} disabled={true}>
                  Running
                </Button>
              )}
              {/* <Button
                  startDecorator={<PlusIcon />}
                  onClick={() => setNewNodeflowModalOpen(true)}
                >
                  Add Node
                </Button> */}
              {/* <Button startDecorator={<PenIcon />} variant="outlined">
                  Edit
                </Button> */}
              <Button startDecorator={<AxeIcon />} variant="outlined">
                Fight
              </Button>

              <Dropdown>
                <MenuButton variant="plain">
                  <EllipsisIcon />
                </MenuButton>
                <Menu>
                  <MenuItem>
                    <ListItemDecorator>
                      <PenIcon />
                    </ListItemDecorator>
                    Edit Workflow Name
                  </MenuItem>
                  <MenuItem color="danger">
                    <ListItemDecorator>
                      <Trash2Icon />
                    </ListItemDecorator>
                    Delete Workflow
                  </MenuItem>
                </Menu>
              </Dropdown>
            </Box>
          </Box>
          <Box
            sx={{
              display: 'flex',
              width: '100%',
              height: '100%',
              overflow: 'hidden',
              flexDirection: 'row',
            }}
          >
            {selectedWorkflow ? (
              <WorkflowCanvas
                selectedWorkflow={selectedWorkflow}
                setNewNodeModalOpen={setNewNodeflowModalOpen}
              />
            ) : (
              <Box sx={{ width: '100%', backgroundColor: '#F7F9FB' }} p={4}>
                Select Workflow
              </Box>
            )}
          </Box>
        </Box>
      </Sheet>
    </Sheet>
  );
}
