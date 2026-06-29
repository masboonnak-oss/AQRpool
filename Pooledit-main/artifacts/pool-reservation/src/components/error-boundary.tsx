import { Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw } from "lucide-react";

type Props = { children: ReactNode };
type State = { error: Error | null };

// App-wide error boundary: a render crash shows a friendly recovery screen instead of a
// blank white page. Keeps the rest of the SPA (and the user's session) intact on reload.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Surfaced to the browser console for diagnostics; no PII is logged.
    console.error("[ErrorBoundary]", error);
  }

  private reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-display font-bold">เกิดข้อผิดพลาดบางอย่าง</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            ระบบพบปัญหาที่ไม่คาดคิด ลองโหลดหน้าใหม่อีกครั้ง หากยังพบปัญหากรุณาติดต่อทีมงาน
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Button onClick={() => window.location.reload()}>
              <RotateCcw className="mr-2 h-4 w-4" />โหลดหน้าใหม่
            </Button>
            <Button variant="outline" onClick={this.reset}>ลองอีกครั้ง</Button>
          </div>
        </div>
      </div>
    );
  }
}
