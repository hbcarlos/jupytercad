import { URLExt } from '@jupyterlab/coreutils';
import { ServerConnection, ServiceManager, User } from '@jupyterlab/services';
import { Kernel, KernelMessage } from '@jupyterlab/services';
import { JupyterCadModel } from '../model';
import {
  IJupyterCadWidgetModelRegistry,
  IJupyterCadWidgetManager
} from './token';
import { WebSocketProvider } from '@jupyterlab/docprovider';
import { YCommProvider } from './yCommProvider';
import { IJupyterCadModel } from '../types';
const Y_DOCUMENT_PROVIDER_URL = 'api/yjs';

export class JupyterCadWidgetManager implements IJupyterCadWidgetManager {
  constructor(options: { manager: ServiceManager.IManager }) {
    this._manager = options.manager;
  }
  registerKernel(kernel: Kernel.IKernelConnection): void {
    const wm = new WidgetModelRegistry({ kernel, manager: this._manager });
    this._registry.set(kernel.id, wm);
  }

  unregisterKernel(kernelId?: string | null): void {
    if (kernelId) {
      this._registry.delete(kernelId);
    }
  }

  getWidgetModel(
    kernelId: string,
    commId: string
  ): IJupyterCadModel | undefined {
    return this._registry.get(kernelId)?.getModel(commId);
  }

  private _registry = new Map<string, IJupyterCadWidgetModelRegistry>();
  private _manager: ServiceManager.IManager;
}

export class WidgetModelRegistry implements IJupyterCadWidgetModelRegistry {
  constructor(options: {
    kernel: Kernel.IKernelConnection;
    manager: ServiceManager.IManager;
  }) {
    const { kernel, manager } = options;
    this._manager = manager;
    kernel.registerCommTarget('@jupytercad:widget', this._handle_comm_open);
  }

  getModel(id: string): IJupyterCadModel | undefined {
    return this._jcadModels.get(id);
  }

  /**
   * Handle when a comm is opened.
   */
  private _handle_comm_open = async (
    comm: Kernel.IComm,
    msg: KernelMessage.ICommOpenMsg
  ): Promise<void> => {
    const { path, format, contentType } = msg.content.data as {
      path?: string;
      format?: string;
      contentType?: string;
    };

    const jcadModel = new JupyterCadModel({});
    const user = this._manager.user;
    if (path && format && contentType) {
      const server = ServerConnection.makeSettings();
      const serverUrl = URLExt.join(server.wsUrl, Y_DOCUMENT_PROVIDER_URL);
      const ywsProvider = new WebSocketProvider({
        url: serverUrl,
        path,
        format,
        contentType,
        model: jcadModel.sharedModel,
        user
      });
      jcadModel.disposed.connect(() => {
        ywsProvider.dispose();
      });
      await ywsProvider.ready;
    } else {
      const awareness = jcadModel.sharedModel.awareness;
      const _onUserChanged = (user: User.IManager) => {
        awareness.setLocalStateField('user', user.identity);
      };
      user.ready
        .then(() => {
          _onUserChanged(user);
        })
        .catch(e => console.error(e));
      user.userChanged.connect(_onUserChanged, this);
    }

    new YCommProvider({
      comm,
      ydoc: jcadModel.sharedModel.ydoc
    });
    this._jcadModels.set(comm.commId, jcadModel);
  };

  private _jcadModels: Map<string, IJupyterCadModel> = new Map();
  private _manager: ServiceManager.IManager;
}