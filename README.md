#  FileLink

**FileLink** is a lightweight, self-hosted file sharing app that runs in a container. It allows users to upload files and share them using simple, secure external links—**no login required**. The owner of the instance can log in to manage upload groups and access controls.
![image](https://github.com/user-attachments/assets/6878454f-2691-486f-b5d4-04d4fe432e21)

## ✨ Features

*  **Quick Uploads** – Drag & drop files to upload instantly.
*  **Shareable Links** – Share files via direct links with built-in access control.
*  **Admin Dashboard** – Authenticated users can manage uploads and organize them into groups.
* 🛠 **No Database Setup Needed** – Supports SQLite or MySQL.
*  **Modern UI** – Clean, minimalist interface designed for simplicity.
*  **Movie Metadata Integration** – Plug in [OMDb API](https://www.omdbapi.com/) to fetch movie details and posters automatically.

## 🚀 Getting Started

### Run with Docker

```bash
docker run -d \
  -p 8080:80 \
  -v ./filelink-data:/app/data \
  --name filelink \
  robododd/filelink:latest
```

> Visit `http://localhost:8080` after it starts.

You can run the project straight out of the box without any configuration or you can configure the following. Changing JWTAUTHSETTINGS will require you to build the project yourself.
### ⚙️ Environment Variables

| Variable                                   | Description                  | Default                    |
| ------------------------------------------ | ---------------------------- | -------------------------- |
| `STORAGESETTINGS__SHAREDFILESPATH`         | Path to store uploaded files | `data/files`               |
| `STORAGESETTINGS__DATABASEFILESPATH`       | Path to store database files | `data/db`                  |
| `DATABASETYPE`                             | `sqlite` or `mysql`          | `sqlite`                   |
| `CONNECTIONSTRINGS__DEFAULTCONNECTION`     | MySQL connection string      | See config                 |
| `BASEDOMAIN`                               | Base URL of instance         | `https://localhost:7065`   |
| `JWTAUTHSETTINGS__VALIDISSUER`             | JWT issuer                   | `https://www.filelink.com` |
| `JWTAUTHSETTINGS__VALIDAUDIENCE`           | JWT audience                 | `https://www.filelink.com` |
| `JWTAUTHSETTINGS__CLIENTID`                | JWT client ID                | `filelink`                 |
| `OMDBSETTINGS__APIKEY`                     | OMDb API key for metadata    | *unset*                    |
| `OMDBSETTINGS__BASEURL`                    | OMDb API base URL            | `https://www.omdbapi.com/` |
| `LOGGING__LOGLEVEL__DEFAULT`               | Default logging level        | `Information`              |
| `LOGGING__LOGLEVEL__MICROSOFT__ASPNETCORE` | ASP.NET Core log level       | `Warning`                  |

> **Note:** The admin login uses fixed credentials:
>
> * **Username:** `admin`
> * **Password:** `admin`

### Volume Mounts (optional)

* `/app/data`: Local path for file storage.
* `/app/appsettings.json`: Custom configuration file.

##  Movie Metadata

If your uploaded file names include movie titles, FileLink can automatically pull in metadata such as:

* Title, Year, Genre, IMDB ID
* Movie Posters
* Ratings and Descriptions

To enable this feature, set your `OMDBSETTINGS__APIKEY` environment variable with a valid key from [omdbapi.com](https://www.omdbapi.com/apikey.aspx).

##  File Groups

* Each file is part of a **group**.
* Group links allow recipients to access multiple files.
* Groups can expire or be deleted by the admin.

##  Security

* Public access only via shared links.
* Admin panel protected by login.
* Links can be set to expire automatically.

##  Tech Stack

* **Backend:** ASP.NET Core 9
* **Frontend:** Angular 19 (standalone components)
* **Database:** SQLite or MySQL
* **Containerized:** Runs easily in Docker or k8s

## 📷 Screenshots

![image](https://github.com/user-attachments/assets/a317c83d-0201-4aaa-a3c9-6ffca556e786)
![image](https://github.com/user-attachments/assets/ef7c92a8-a640-4bd4-9b93-d04bd4fac86a)
![image](https://github.com/user-attachments/assets/746d7edf-315d-49e7-a6cf-c7d1791b1bfb)


## 🧪 Development

Clone and run locally:

```bash
git clone https://github.com/timothydodd/FileLink.git
cd filelink
docker compose up --build
```

## 📄 License

MIT © [Tim Dodd](https://github.com/timothydodd)
