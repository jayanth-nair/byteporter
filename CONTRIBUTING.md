# Contributing to BytePorter

Thank you for your interest in contributing to BytePorter! We welcome contributions from the community.

## Getting Started

1.  **Fork the repository**.
2.  **Clone your fork**: `git clone https://github.com/your-username/byteporter.git`
3.  **Install dependencies**:
    ```bash
    cd server && npm install
    cd ../client && npm install
    ```
4.  **Set up Environment Variables**: Copy `.env.example` to `.env` in the `server/` directory.

## Development Workflow

1.  Create a new branch for your feature or fix: `git checkout -b feature/my-new-feature`
2.  Make your changes.
3.  Run tests to ensure nothing is broken:
    - Server: `cd server && npm test`
    - Client: `cd client && npm test`
4.  Commit your changes with descriptive messages.
5.  Push to your fork and submit a **Pull Request**.

## Code Style

-   Keep code clean and readable.
-   Use modern JavaScript/ES6+ features.
-   Follow the existing folder structure.

## Reporting Issues

If you find a bug, please open an issue on GitHub with details on how to reproduce it.
