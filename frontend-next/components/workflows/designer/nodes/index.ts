import { NodeTypes } from "@xyflow/react";
import { StartEventNode } from "./StartEventNode";
import { EndEventNode } from "./EndEventNode";
import { UserTaskNode } from "./UserTaskNode";
import { ServiceTaskNode } from "./ServiceTaskNode";
import { ExclusiveGatewayNode } from "./ExclusiveGatewayNode";
import { ParallelGatewayNode } from "./ParallelGatewayNode";
import { TimerEventNode } from "./TimerEventNode";
import { DataStoreReferenceNode } from "./DataStoreReferenceNode";

export const nodeTypes: NodeTypes = {
  start_event: StartEventNode,
  end_event: EndEventNode,
  user_task: UserTaskNode,
  service_task: ServiceTaskNode,
  exclusive_gateway: ExclusiveGatewayNode,
  parallel_gateway: ParallelGatewayNode,
  timer_event: TimerEventNode,
  data_store_reference: DataStoreReferenceNode,
};

export {
  StartEventNode,
  EndEventNode,
  UserTaskNode,
  ServiceTaskNode,
  ExclusiveGatewayNode,
  ParallelGatewayNode,
  TimerEventNode,
  DataStoreReferenceNode,
};
