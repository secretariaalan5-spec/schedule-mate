import { Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props { children: ReactNode }
interface State { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error("ErrorBoundary caught:", error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-6 bg-background">
        <div className="max-w-md w-full bg-card border rounded-2xl shadow-lg p-6 text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-destructive" />
          </div>
          <div>
            <h2 className="font-bold text-lg">Algo deu errado</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {this.state.error.message || "Ocorreu um erro inesperado."}
            </p>
          </div>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={this.reset}>Tentar novamente</Button>
            <Button onClick={() => window.location.reload()}>Recarregar</Button>
          </div>
        </div>
      </div>
    );
  }
}