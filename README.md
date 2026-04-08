# huozige-web-app-cli

基于 TypeScript 重写的 Forguncy Web App MQTT CLI，严格保留原 Go 版本的命令定义、参数名和 MQTT 消息字段。

## 安装

```bash
npm install huozige-web-app-cli
```

安装后可以继续使用原来的命令名：

```bash
fgc-web status
```

也可以直接用包名对应的可执行文件：

```bash
huozige-web-app-cli status
```

## 配置

默认读取当前目录下的 `config.json`，也支持用 `-c` 或 `--config` 指定。

示例配置：

```json
{
  "mqttBroker": "tcp://localhost:1883",
  "username": "your-username",
  "password": "your-password",
  "requestTopic": "forguncy/req",
  "responseTopic": "forguncy/res",
  "timeout": 200
}
```

## 命令

```bash
huozige-web-app-cli servercommand [applicationName] [commandName] [method] [jsonBody] -u [userName] -s [sessionId] -a [agentName]
huozige-web-app-cli binding [applicationName] [commandName] [method] [jsonBody] -u [userName] -s [sessionId] -a [agentName]
huozige-web-app-cli status
```

## 参数说明

- `applicationName`: 应用名称
- `commandName`: 命令名称
- `method`: HTTP 方法
- `jsonBody`: JSON 格式参数
- `-u, --userName`: 用户名
- `-s, --sessionId`: 会话 ID
- `-a, --agentName`: 代理名
- `-c, --config`: 本地 JSON 配置文件路径，默认 `config.json`

## 使用示例

### 1. `servercommand` POST

```powershell
huozige-web-app-cli servercommand test getData POST '{"name":"张三"}' -u hanzhou -s 4 -a main
```

### 2. `servercommand` GET

```powershell
huozige-web-app-cli servercommand test search GET '{"userId":"123"}' -u hanzhou -s 4 -a main
```

### 3. `binding`

```powershell
$json = '{"CommandId":"83383bb0-1849-4feb-bee9-e538a6ca8c76","Params":{},"options":{"distinct":true}}'
huozige-web-app-cli binding test CalcBindingDataSource POST $json -u Administrator -s 5 -a main
```

### 4. 查看配置状态

```powershell
huozige-web-app-cli status
huozige-web-app-cli --config .\dev.config.json status
```

## 兼容性说明

- 保留 `servercommand`、`binding`、`status` 三个命令。
- `binding` 允许 `GetTableDataWithOffset`（TableBinding）、`GetComboBindingOptions`（CandidatesBinding）。
- MQTT 请求消息仍然使用 `traceId`、`command`、`userName`、`sessionId`、`agentName`、`parameters`、`timestamp` 这些字段。
- 响应既支持包裹格式 `{ code, message, data }`，也支持直接返回原始 JSON。
