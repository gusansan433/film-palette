# Film Palette · 胶片配色

公共领域 / CC 画面按颜色归档：电影剧照、绘画、设计、壁画、纹样。不会去爬商业影站。

## 本机预览

```bash
npm install
npm run daily
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。国内请先开系统代理（项目会读 `HTTPS_PROXY`）。

- `npm run daily`：收录最多 100 张可授权画面
- `npm run art`：名画 / 壁画 / 纹样 / 雕塑
- 不要同时开多个收录进程

## 每天自动更新 100 张

网页服务器**不能**自己长期写文件。每天新增的图必须写进仓库，再重新部署。

GitHub Actions 已设为每天 UTC 0 点（北京时间 8:00）跑：

```text
npx tsx scripts/ingest.ts --photos --art --count=100
```

并把 `data/catalog.json`、`public/stills/` 提交回去。打开仓库的 Actions，允许定时任务即可。也可手动点 **Run workflow**。

若部署在自己的香港 / 国内服务器上，也可以在机器上设定时任务（图直接写进磁盘，不用每次重建镜像）：

```cron
0 8 * * * cd /opt/film-palette && npm run daily
```

## 做成国内能打开的网站

Vercel / GitHub Pages 在国内经常打不开。要国内能访问，优先下面两条：

1. **腾讯云或阿里云轻量「香港」**（通常不用备案，国内能开）
2. 大陆服务器必须先做 **ICP 备案**

香港机器示例：

```bash
git clone <你的仓库>
cd film-palette
docker compose up -d --build
```

浏览器打开 `http://服务器IP:3000`。有域名就把 DNS A 记录指到这台机器，再用 Nginx / Caddy 反代到 3000。

国际访问可以用 Vercel 导入同一仓库；国内用户请走香港机或已备案的国内机。

## 费用

Cursor 订阅只覆盖在编辑器里写代码，不含网站托管。

| 项目 | 费用 |
| --- | --- |
| 本机预览 | 免费 |
| GitHub 每日自动抓取 | 免费 |
| 腾讯云 / 阿里云香港轻量 | 大约几十元 / 月 |
| 域名（可选） | 大约几十元 / 年 |
| Vercel Hobby | 通常免费，但国内常打不开 |

每天 100 张图大约增加十几 MB。图都放在 Git 里的话，仓库会变大；以后图特别多再换成对象存储。

## 上线步骤

1. 把本文件夹建成 Git 仓库并推到 GitHub  
2. 打开 GitHub Actions，让每天定时收录 100 张  
3. 香港云主机 `docker compose up -d --build`，或 Vercel 导入仓库（国际）  
4. 把域名解析到香港机（国内用户走这条）
