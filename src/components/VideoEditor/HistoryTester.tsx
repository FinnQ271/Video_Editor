import EditorDialog from './EditorDialog'
import { useState } from 'react'
import { runHistoryTestSuite } from '../../utils/historyTest'
import type { TestLog } from '../../utils/historyTest'

interface HistoryTesterProps {
  isOpen: boolean
  onClose: () => void
}

export default function HistoryTester({ isOpen, onClose }: HistoryTesterProps) {
  const [testResult, setTestResult] = useState<{ logs: TestLog[]; allPassed: boolean } | null>(null)
  const [isRunning, setIsRunning] = useState(false)

  if (!isOpen) return null

  const handleRunTest = () => {
    setIsRunning(true)
    setTimeout(() => {
      const result = runHistoryTestSuite()
      setTestResult(result)
      setIsRunning(false)
    }, 200)
  }

  return (
    <EditorDialog title="History diagnostics" onClose={onClose} busy={isRunning}>
        <div className="history-modal-header">
          <h2>History diagnostics</h2>
          <button type="button" className="btn-close" title="Close diagnostics" aria-label="Close diagnostics" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="history-modal-body">
          <p className="test-desc">
            Executes the required action sequence test chain:
            <br />
            <strong>Add → Move → Split → Trim → Delete</strong>
            <br />
            Followed by <strong>5x Step-by-Step Undo</strong> and <strong>5x Step-by-Step Redo</strong>.
          </p>

          <div className="test-action-bar">
            <button
              type="button"
              className="btn-primary btn-run-test"
              onClick={handleRunTest}
              disabled={isRunning}
            >
              {isRunning ? 'Running Test Suite…' : '▶ Execute Test Chain'}
            </button>
          </div>

          {testResult && (
            <div className={`test-summary-banner ${testResult.allPassed ? 'banner-pass' : 'banner-fail'}`}>
              <div className="banner-status">
                {testResult.allPassed ? '✅ ALL 15 VERIFICATION STEPS PASSED' : '❌ TEST FAILURE DETECTED'}
              </div>
              <div className="banner-sub">
                {testResult.allPassed
                  ? 'History restoration state is 100% accurate across all operations.'
                  : 'Check detailed log steps below.'}
              </div>
            </div>
          )}

          {testResult && (
            <div className="test-logs-table-wrapper">
              <table className="test-logs-table">
                <thead>
                  <tr>
                    <th>Step</th>
                    <th>Action</th>
                    <th>Status</th>
                    <th>Past</th>
                    <th>Future</th>
                    <th>Clips</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {testResult.logs.map((log, idx) => (
                    <tr key={idx} className={log.passed ? 'row-pass' : 'row-fail'}>
                      <td>
                        <strong>{log.step}</strong>
                      </td>
                      <td>{log.actionName}</td>
                      <td>
                        <span className={`status-pill ${log.passed ? 'pill-pass' : 'pill-fail'}`}>
                          {log.passed ? 'PASS' : 'FAIL'}
                        </span>
                      </td>
                      <td>{log.pastCount}</td>
                      <td>{log.futureCount}</td>
                      <td>{log.clipCount}</td>
                      <td className="cell-details">{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="history-modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
    </EditorDialog>
  )
}
