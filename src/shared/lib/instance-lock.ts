export async function withInstanceLock(
  name: string,
  signal: AbortSignal,
  run: () => Promise<void>,
): Promise<boolean> {
  if (!navigator.locks) {
    await run()
    return true
  }
  const timeout = AbortSignal.timeout(1500)
  let acquired = false
  try {
    await navigator.locks.request(
      name,
      { signal: AbortSignal.any([signal, timeout]) },
      async () => {
        acquired = true
        if (!signal.aborted) await run()
      },
    )
    return true
  } catch (error) {
    if (signal.aborted) return true
    if (timeout.aborted && !acquired) return false
    throw error
  }
}
