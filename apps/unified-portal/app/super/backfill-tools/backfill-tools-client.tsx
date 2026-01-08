'use client';

import { useState, useEffect } from 'react';

interface Project {
  id: string;
  name: string;
}

interface BackfillResult {
  projectId: string;
  projectName: string;
  unitTypesCreated: number;
  unitsUpdated: number;
  errors: string[];
}

interface BackfillSummary {
  mode: 'dry-run' | 'apply';
  projectsProcessed: number;
  totalUnitTypesCreated: number;
  totalUnitsUpdated: number;
  results: BackfillResult[];
  executedAt: string;
  executedBy: string;
}

interface JobStatus {
  inProgress: boolean;
  lastRun: string | null;
  lastRunBy: string | null;
}

export function BackfillTools() {
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [projectsNeedingBackfill, setProjectsNeedingBackfill] = useState<Project[]>([]);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [runAllProjects, setRunAllProjects] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  
  const [summary, setSummary] = useState<BackfillSummary | null>(null);

  useEffect(() => {
    fetchStatus();
  }, []);

  async function fetchStatus() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/admin/backfill-unit-types');
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch status');
      }
      const data = await res.json();
      setAllProjects(data.allProjects || []);
      setProjectsNeedingBackfill(data.projectsNeedingBackfill || []);
      setJobStatus(data.jobStatus || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  async function runBackfill(dryRun: boolean) {
    try {
      setRunning(true);
      setError(null);
      setSummary(null);

      const body: Record<string, any> = { dryRun };
      
      if (runAllProjects) {
        body.allProjects = true;
        body.confirmAll = confirmAll;
      } else if (selectedProjectId) {
        body.projectId = selectedProjectId;
      } else {
        throw new Error('Please select a project or enable "Run on all projects"');
      }

      const res = await fetch('/api/admin/backfill-unit-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Backfill failed');
      }

      setSummary(data.summary);
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run backfill');
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">Loading backfill tools...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Backfill Tools</h1>
      
      <div className="bg-white border rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Unit Types Backfill</h2>
        <p className="text-gray-600 mb-4">
          This tool creates unit_types records from unit metadata and links units to their types.
          It is safe to run multiple times (idempotent).
        </p>

        {jobStatus && (
          <div className="bg-gray-50 rounded p-3 mb-4 text-sm">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${jobStatus.inProgress ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`} />
              <span>{jobStatus.inProgress ? 'Job in progress...' : 'Ready'}</span>
            </div>
            {jobStatus.lastRun && (
              <div className="text-gray-500 mt-1">
                Last run: {new Date(jobStatus.lastRun).toLocaleString()} by {jobStatus.lastRunBy}
              </div>
            )}
          </div>
        )}

        {projectsNeedingBackfill.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4">
            <div className="font-medium text-yellow-800">
              {projectsNeedingBackfill.length} project(s) may need backfill:
            </div>
            <ul className="text-sm text-yellow-700 mt-1">
              {projectsNeedingBackfill.slice(0, 5).map(p => (
                <li key={p.id}>{p.name}</li>
              ))}
              {projectsNeedingBackfill.length > 5 && (
                <li>...and {projectsNeedingBackfill.length - 5} more</li>
              )}
            </ul>
          </div>
        )}

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-1">Target</label>
            <div className="flex items-center gap-4 mb-2">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="target"
                  checked={!runAllProjects}
                  onChange={() => setRunAllProjects(false)}
                  disabled={running}
                />
                <span>Single project</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="target"
                  checked={runAllProjects}
                  onChange={() => setRunAllProjects(true)}
                  disabled={running}
                />
                <span>All projects needing backfill</span>
              </label>
            </div>
            
            {!runAllProjects && (
              <select
                className="w-full border rounded px-3 py-2"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                disabled={running}
              >
                <option value="">Select a project...</option>
                {allProjects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {projectsNeedingBackfill.some(x => x.id === p.id) ? ' (needs backfill)' : ''}
                  </option>
                ))}
              </select>
            )}

            {runAllProjects && (
              <label className="flex items-center gap-2 mt-2 text-sm">
                <input
                  type="checkbox"
                  checked={confirmAll}
                  onChange={(e) => setConfirmAll(e.target.checked)}
                  disabled={running}
                />
                <span className="text-red-600">I confirm I want to run on all {projectsNeedingBackfill.length} projects</span>
              </label>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 mb-4">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => runBackfill(true)}
            disabled={running || jobStatus?.inProgress || (!selectedProjectId && !runAllProjects)}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {running ? 'Running...' : 'Dry Run (Preview)'}
          </button>
          <button
            onClick={() => runBackfill(false)}
            disabled={running || jobStatus?.inProgress || (!selectedProjectId && !(runAllProjects && confirmAll))}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {running ? 'Running...' : 'Apply Changes'}
          </button>
          <button
            onClick={fetchStatus}
            disabled={running}
            className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {summary && (
        <div className="bg-white border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">
            Results ({summary.mode === 'dry-run' ? 'Preview' : 'Applied'})
          </h3>
          
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-gray-50 rounded p-3 text-center">
              <div className="text-2xl font-bold">{summary.projectsProcessed}</div>
              <div className="text-sm text-gray-600">Projects Processed</div>
            </div>
            <div className="bg-green-50 rounded p-3 text-center">
              <div className="text-2xl font-bold text-green-700">{summary.totalUnitTypesCreated}</div>
              <div className="text-sm text-gray-600">Unit Types {summary.mode === 'dry-run' ? 'To Create' : 'Created'}</div>
            </div>
            <div className="bg-blue-50 rounded p-3 text-center">
              <div className="text-2xl font-bold text-blue-700">{summary.totalUnitsUpdated}</div>
              <div className="text-sm text-gray-600">Units {summary.mode === 'dry-run' ? 'To Update' : 'Updated'}</div>
            </div>
          </div>

          <div className="text-sm text-gray-500 mb-4">
            Executed at {new Date(summary.executedAt).toLocaleString()} by {summary.executedBy}
          </div>

          {summary.results.length > 0 && (
            <div className="border rounded overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left">Project</th>
                    <th className="px-4 py-2 text-right">Types</th>
                    <th className="px-4 py-2 text-right">Units</th>
                    <th className="px-4 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.results.map((r) => (
                    <tr key={r.projectId} className="border-t">
                      <td className="px-4 py-2">{r.projectName}</td>
                      <td className="px-4 py-2 text-right">{r.unitTypesCreated}</td>
                      <td className="px-4 py-2 text-right">{r.unitsUpdated}</td>
                      <td className="px-4 py-2">
                        {r.errors.length > 0 ? (
                          <span className="text-red-600">{r.errors.length} error(s)</span>
                        ) : (
                          <span className="text-green-600">OK</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {summary.results.some(r => r.errors.length > 0) && (
            <div className="mt-4">
              <h4 className="font-medium mb-2">Errors</h4>
              <div className="bg-red-50 rounded p-3 text-sm text-red-700">
                {summary.results.flatMap(r => r.errors.map((e, i) => (
                  <div key={`${r.projectId}-${i}`}>[{r.projectName}] {e}</div>
                )))}
              </div>
            </div>
          )}

          {summary.mode === 'dry-run' && summary.totalUnitTypesCreated + summary.totalUnitsUpdated > 0 && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
              This was a preview. Click "Apply Changes" to execute these changes.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
