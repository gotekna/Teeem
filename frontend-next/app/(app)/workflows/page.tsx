import { ClipboardDocumentCheckIcon } from "@heroicons/react/24/outline";
import WorkflowTaskList from "@/components/workflows/WorkflowTaskList";

export default function WorkflowsPage() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <div className="flex items-center">
          <ClipboardDocumentCheckIcon className="h-8 w-8 text-indigo-600 mr-3" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Workflow Approvals
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Review and approve pending workflow tasks
            </p>
          </div>
        </div>
      </div>

      <WorkflowTaskList />
    </div>
  );
}
