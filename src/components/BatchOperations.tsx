import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Repository, BatchOperation, BatchResult, BatchOperationType } from "../types";
import { 
  Play, 
  Download, 
  Upload, 
  RefreshCw, 
  GitPullRequest,
  CheckCircle,
  XCircle,
  Terminal
} from "lucide-react";

interface BatchOperationsProps {
  repositories: Repository[];
  selectedRepos: Set<string>;
  onRefresh: () => void;
}

export function BatchOperations({ repositories, selectedRepos, onRefresh }: BatchOperationsProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BatchResult | null>(null);
  const [customCommand, setCustomCommand] = useState("");

  const selectedRepositories = repositories.filter(repo => selectedRepos.has(repo.path));

  const executeOperation = async (operationType: BatchOperationType, parameters: Record<string, any> = {}) => {
    if (selectedRepos.size === 0) return;

    setLoading(true);
    setResult(null);

    try {
      const operation: BatchOperation = {
        operation_type: operationType,
        parameters
      };

      const batchResult = await invoke<BatchResult>("batch_git_operation", {
        repos: Array.from(selectedRepos),
        operation
      });

      setResult(batchResult);
      
      // Refresh the repositories list after operations that might change status
      if (['Pull', 'Push', 'Fetch'].includes(operationType)) {
        setTimeout(onRefresh, 1000);
      }
    } catch (error) {
      console.error("Batch operation failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const operations = [
    {
      id: 'pull' as BatchOperationType,
      label: 'Pull',
      description: 'Pull latest changes from remote',
      icon: Download,
      className: 'bg-blue-500 hover:bg-blue-600',
    },
    {
      id: 'push' as BatchOperationType,
      label: 'Push',
      description: 'Push local commits to remote',
      icon: Upload,
      className: 'bg-green-500 hover:bg-green-600',
    },
    {
      id: 'fetch' as BatchOperationType,
      label: 'Fetch',
      description: 'Fetch latest refs from remote',
      icon: RefreshCw,
      className: 'bg-purple-500 hover:bg-purple-600',
    },
    {
      id: 'status' as BatchOperationType,
      label: 'Status',
      description: 'Get working directory status',
      icon: GitPullRequest,
      className: 'bg-orange-500 hover:bg-orange-600',
    },
  ];

  const executeCustomCommand = async () => {
    if (!customCommand.trim() || selectedRepos.size === 0) return;

    const commandParts = customCommand.trim().split(/\s+/);
    await executeOperation('Custom', { command: commandParts });
  };

  return (
    <div className="flex-1 flex flex-col p-6">
      <div className="max-w-6xl mx-auto w-full space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold mb-2">Batch Operations</h1>
          <p className="text-muted-foreground">
            Perform Git operations on multiple repositories simultaneously
          </p>
        </div>

        {/* Selection Summary */}
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Selected Repositories</h3>
              <p className="text-sm text-muted-foreground">
                {selectedRepos.size} of {repositories.length} repositories selected
              </p>
            </div>
            
            {selectedRepos.size > 0 && (
              <div className="text-right">
                <div className="text-sm text-muted-foreground mb-1">Ready for batch operations</div>
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
            )}
          </div>

          {selectedRepos.size > 0 && (
            <div className="mt-4 max-h-32 overflow-auto">
              <div className="text-sm space-y-1">
                {selectedRepositories.map((repo) => (
                  <div key={repo.path} className="flex items-center justify-between py-1 px-2 bg-muted rounded">
                    <span className="font-medium">{repo.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {repo.current_branch || 'No branch'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {selectedRepos.size === 0 ? (
          <div className="text-center py-12">
            <GitPullRequest className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">No repositories selected</p>
            <p className="text-muted-foreground">
              Select repositories from the repositories view to perform batch operations
            </p>
          </div>
        ) : (
          <>
            {/* Quick Operations */}
            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="font-medium mb-4">Quick Operations</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {operations.map((op) => {
                  const Icon = op.icon;
                  return (
                    <button
                      key={op.id}
                      onClick={() => executeOperation(op.id)}
                      disabled={loading}
                      className={`p-4 text-white rounded-lg transition-colors disabled:opacity-50 ${op.className}`}
                    >
                      <Icon className="w-6 h-6 mx-auto mb-2" />
                      <div className="font-medium">{op.label}</div>
                      <div className="text-xs opacity-90 mt-1">{op.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Command */}
            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="font-medium mb-4">Custom Git Command</h3>
              
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <Terminal className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <input
                    type="text"
                    value={customCommand}
                    onChange={(e) => setCustomCommand(e.target.value)}
                    placeholder="git status --porcelain"
                    className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-transparent font-mono"
                    onKeyPress={(e) => e.key === 'Enter' && executeCustomCommand()}
                  />
                </div>
                
                <button
                  onClick={executeCustomCommand}
                  disabled={loading || !customCommand.trim()}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  <Play className="w-4 h-4" />
                </button>
              </div>
              
              <p className="text-xs text-muted-foreground mt-2">
                Execute any git command on selected repositories. Command will be run in each repository's directory.
              </p>
            </div>
          </>
        )}

        {/* Loading Indicator */}
        {loading && (
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-center gap-3">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              <span>Executing batch operation...</span>
            </div>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">Batch Operation Results</h3>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  {result.successful} successful
                </div>
                <div className="flex items-center gap-1 text-red-600">
                  <XCircle className="w-4 h-4" />
                  {result.failed} failed
                </div>
              </div>
            </div>

            <div className="space-y-3 max-h-96 overflow-auto">
              {result.results.map((r, index) => (
                <div 
                  key={index}
                  className={`border rounded-lg p-4 ${
                    r.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {r.success ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600" />
                    )}
                    <span className="font-medium">
                      {r.repo_path.split('/').pop()}
                    </span>
                  </div>
                  
                  {r.output && (
                    <pre className="text-sm font-mono bg-muted p-2 rounded overflow-x-auto">
                      {r.output}
                    </pre>
                  )}
                  
                  {r.error && (
                    <div className="text-sm text-red-600 font-mono bg-red-100 p-2 rounded mt-2">
                      {r.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}