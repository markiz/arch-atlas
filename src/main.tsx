import { render } from 'preact';
import App from './App';
import './style.css';
import { startServiceWorker } from './service-worker';

void startServiceWorker();
render(<App />, document.getElementById('root')!);
