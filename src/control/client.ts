import { SOCKET_PATH, type ControlRequest, type ControlResponse } from "./protocol.ts";

export class NotRunningError extends Error {
  constructor() {
    super("No running nocki instance found. Start one with `nocki start`.");
    this.name = "NotRunningError";
  }
}

export async function sendControl(
  req: ControlRequest,
  socketPath = SOCKET_PATH,
): Promise<ControlResponse> {

  return new Promise<ControlResponse>((resolve, reject) => {
    let buffer = "";
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    const attempt = Bun.connect({
      unix: socketPath,
      socket: {
        open: (socket) => {
          socket.write(JSON.stringify(req) + "\n");
        },
        data: (_socket, data) => {
          buffer += data.toString("utf8");
        },
        close: () => {
          finish(() => {
            const text = buffer.trim();
            if (!text) {
              reject(new NotRunningError());
              return;
            }
            try {
              resolve(JSON.parse(text) as ControlResponse);
            } catch {
              reject(new Error("Malformed response from nocki instance."));
            }
          });
        },
        error: () => {
          finish(() => reject(new NotRunningError()));
        },
        connectError: () => {
          finish(() => reject(new NotRunningError()));
        },
      },
    });

    attempt.catch(() => finish(() => reject(new NotRunningError())));
  });
}
