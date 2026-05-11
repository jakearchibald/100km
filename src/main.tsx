import { render } from 'preact';
import App from './App.tsx';
import './reset.css';
import './sw-register.ts';

render(<App />, document.getElementById('root')!);
