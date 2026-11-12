import { useRef, type ReactNode } from 'react';

type Props = { loading: boolean; failed: boolean; fallback: ReactNode; children: ReactNode };
/** Keep an already-open page mounted during a failed background refresh, but do not
 * allow interaction with potentially stale data. This preserves unsaved form state. */
export default function DataLoadGuard({ loading, failed, fallback, children }: Props) {
  const rendered = useRef(false);
  if (!loading && !failed) rendered.current = true;
  const blocked = loading || failed;
  return <>{blocked && fallback}{rendered.current && <div hidden={blocked}>{children}</div>}</>;
}
