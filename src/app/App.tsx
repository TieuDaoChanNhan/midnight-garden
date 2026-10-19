import { Component, type ReactNode } from 'react'
import Experience from '../experience/Experience'
import LoadingFallback from '../ui/LoadingFallback'
import { hasWebGL } from '../utils/qualityManager'

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? <LoadingFallback /> : this.props.children
  }
}

export default function App() {
  if (!hasWebGL()) return <LoadingFallback />
  return (
    <Boundary>
      <Experience />
    </Boundary>
  )
}
