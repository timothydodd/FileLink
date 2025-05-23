#  FileLink

**FileLink** is a lightweight, self-hosted file sharing app that runs in a container. It allows users to upload files and share them using simple, secure external links—**no login required**. The owner of the instance can log in to manage upload groups and access controls.


![image](https://github.com/user-attachments/assets/68d69c24-92d7-4b79-a922-8825704e4a04)

![image](https://github.com/user-attachments/assets/3c4af4b0-f057-421c-a1f1-4660f2e39bbb)

![image](https://github.com/user-attachments/assets/866a4b44-8954-42d7-98d2-902b9d51f0b9)

## ✨ Features

*  **Quick Uploads** – Drag & drop files to upload instantly.
*  **Shareable Links** – Share files via direct links with built-in access control.
*  **Admin Dashboard** – Authenticated users can manage uploads and organize them into groups.
* 🛠 **No Database Setup Needed** – Supports SQLite or MySQL.
*  **Modern UI** – Clean, minimalist interface designed for simplicity.
*  **Movie Metadata Integration** – Plug in [OMDb API](https://www.omdbapi.com/) to fetch movie details and posters automatically.
* **Attach Host Files** - Can share files mapped to the host 
## 🚀 Getting Started

### Run with Docker
out of the box
```bash
docker run -d -p 8080:8080 timdoddcool/filelink
```

Advanced Configurations
```bash
docker run -d -p 8080:8080 -v C:\local-shares\:/app/external \
-e StorageSettings__LocalSharedPaths__0=/app/external/ \
-e OmdbSettings__ApiKey=my-key file-link \
-e API_URL=https://your-domain.com \
-e Auth__ClientId=your-client-id \
-e Auth__Audience=your-domain.com \
-e AUTH_USE_LOCAL_STORAGE=true \
timdoddcool/filelink
```

> Visit `http://localhost:8080` after it starts.

You can run the project straight out of the box without any configuration or you can configure the following. Changing JWTAUTHSETTINGS will require you to build the project yourself.
### ⚙️ Environment Variables

| Variable                                   | Description                  | Default                    |
| ------------------------------------------ | ---------------------------- | -------------------------- |
| `StorageSettings__SharedFilesPath`         | Path to store uploaded files | `data/files`               |
| `StorageSettings__DatabaseFilesPath`       | Path to store database files | `data/db`                  |
| `StorageSettings__LocalSharedPaths`       | Local files to share, is an array use StorageSettings__LocalSharedPaths_0, StorageSettings__LocalSharedPaths_1 ect  | null                 |
| `DatabaseType`                             | `sqlite` or `mysql`          | `sqlite`                   |
| `ConnectionStrings__DefaultConnection`     | MySQL connection string (not needed for sqlite)     | See config                 |
| `Auth__ClientId`             | JWT issuer                   | `--filelink--` |
| `Auth__Audience`           | JWT audience                 | `--filelink--` |
| `Auth__ClientId`                | JWT client ID                | `--filelink--`                 |
| `Auth__RefreshTokenExpiryInDays`                | How many days does your Refresh Token Last              | `15`                 |
| `Auth__AccessTokenExpiryInMinutes`                | How many minutes does your Access token last             | `15`                 |
| `OmdbSettings__ApiKey`                     | OMDb API key for metadata    | *unset*                    |
| `Logging__LogLevel`               | Default logging level        | `Information`              |

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
