# Issue 82 — P1-O07 review remediation

Status: IMPLEMENTED. Findings WR01.

The Win32 bridge now assigns the process to its kill-on-close Job at creation using PROC_THREAD_ATTRIBUTE_JOB_LIST and confirms membership before resume. This removes the separate CreateProcess/AssignProcessToJobObject window. A non-inherited native handle to the invoking Node host is checked before resume and throughout the execution loop; host exit cancels the Job. Handles are closed on every exit path. No fallback or additional isolation level is introduced.

The new real Windows security test starts a root/child/grandchild tree, records the exact bridge PID from the host parent relationship, invokes taskkill /PID <Node host> /F without /T, and requires all four descendant/bridge PIDs to exit within five seconds. Failure cleanup runs only after those observations.

Local build and lint passed. Linux-applicable qualification, adapter and worker tests passed (4 + 2 + 2); 14 Windows-only tests were skipped. WR01 remains a hosted Windows qualification item, not a confirmed local reproduction or a VERIFIED claim. Creation-time Job assignment requires supported Windows; an unsupported capability fails closed. API basis: https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-updateprocthreadattribute . This is process-tree lifecycle/resource containment, not an OS filesystem or network sandbox.

Exact hosted qualification and protected-main post-merge checks remain required. The frozen P1-V10 HUMAN_REVIEW is pending; this implementation does not declare VERIFIED.
