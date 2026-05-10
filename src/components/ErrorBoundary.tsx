import { Component, ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-center text-xs text-[#9a3a3a]">
          组件渲染异常：{this.state.error?.message ?? '未知错误'}
        </div>
      );
    }
    return this.props.children;
  }
}
