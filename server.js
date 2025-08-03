/********************************************************************************
*  WEB322 – Assignment 5
*
*  I declare that this assignment is my own work in accordance with Seneca's
*  Academic Integrity Policy:
*
*  https://www.senecapolytechnic.ca/about/policies/academic-integrity-policy.html
*
*  Name: Nirajan Magrati Student ID: 142798230
*  Date: 2025-07-20
*
********************************************************************************/

require("dotenv").config();
const express = require("express");
const path = require("path");
const http = require("http");
const clientSessions = require("client-sessions");
const authData = require("./modules/auth-service");

const app = express();
app.use(express.urlencoded({ extended: true }));

const projectData = require("./modules/projects");
const HTTP_PORT = process.env.PORT || 8080;

// View engine setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Static assets
app.use("/css", express.static(path.join(__dirname, "public/css")));

// Sessions middleware
app.use(clientSessions({
  cookieName: "session",
  secret: "web322_secret_key",
  duration: 2 * 60 * 1000,
  activeDuration: 1000 * 60
}));

// Make session available to views
app.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});

// Middleware to protect routes
function ensureLogin(req, res, next) {
  if (!req.session.user) res.redirect("/login");
  else next();
}

// Public routes
app.get("/", (req, res) => {
  res.render("home", { page: "/" });
});

app.get("/about", (req, res) => {
  res.render("about", { page: "/about" });
});

// View all projects
app.get("/solutions/projects", (req, res) => {
  const sector = req.query.sector;
  const handler = sector ? projectData.getProjectsBySector(sector) : projectData.getAllProjects();

  handler.then((projects) => {
    if (!projects.length && sector) {
      return res.status(404).render("404", { message: `No projects found for sector: ${sector}` });
    }
    res.render("projects", { projects, page: "/solutions/projects", sector: sector || null });
  }).catch(() => {
    res.status(500).render("500", { message: "Error retrieving projects." });
  });
});

// View single project
app.get("/solutions/projects/:id", (req, res) => {
  projectData.getProjectById(req.params.id)
    .then((project) => {
      res.render("project", { project, page: "" });
    })
    .catch(() => {
      res.status(404).render("404", { message: `No project found with ID: ${req.params.id}` });
    });
});

// Protected routes for project actions
app.get("/solutions/addProject", ensureLogin, (req, res) => {
  projectData.getAllSectors()
    .then((sectors) => {
      res.render("addProject", { sectors });
    })
    .catch(() => {
      res.status(500).render("500", { message: "Unable to load sectors for form." });
    });
});

app.post("/solutions/addProject", ensureLogin, (req, res) => {
  projectData.addProject(req.body)
    .then(() => res.redirect("/solutions/projects"))
    .catch((err) => res.status(500).render("500", { message: `Error adding project: ${err}` }));
});

app.get("/solutions/editProject/:id", ensureLogin, (req, res) => {
  Promise.all([
    projectData.getProjectById(req.params.id),
    projectData.getAllSectors()
  ])
    .then(([project, sectors]) => {
      res.render("editProject", { project, sectors });
    })
    .catch((err) => {
      res.status(404).render("404", { message: err.message || "Project not found" });
    });
});

app.post("/solutions/editProject", ensureLogin, (req, res) => {
  const { id, ...updatedData } = req.body;

  projectData.editProject(id, updatedData)
    .then(() => {
      res.redirect("/solutions/projects");
    })
    .catch((err) => {
      res.status(500).render("500", { message: `Error editing project: ${err}` });
    });
});

app.get("/login", (req, res) => {
  res.render("login", {
    errorMessage: "",
    userName: "",
    page: "/login"
  });
});

app.post("/login", (req, res) => {
  req.body.userAgent = req.get("User-Agent");
  authData.checkUser(req.body).then((user) => {
    req.session.user = {
      userName: user.userName,
      email: user.email,
      loginHistory: user.loginHistory
    };
    res.redirect("/solutions/projects");
  }).catch(err => {
    res.render("login", {
      errorMessage: err,
      userName: req.body.userName,
      page: "/login"
    });
  });
});

app.get("/logout", (req, res) => {
  req.session.reset();
  res.redirect("/");
});

app.get("/userHistory", ensureLogin, (req, res) => {
  res.render("userHistory");
});

// 404 fallback
app.use((req, res) => {
  res.status(404).render("404", { message: "Page not found." });
});

// Init & start server
projectData.initialize()
  .then(authData.initialize)
  .then(() => {
    http.createServer(app).listen(HTTP_PORT, () => {
      console.log(`🚀 Server listening on port ${HTTP_PORT}`);
    });
  })
  .catch((err) => {
    console.error("Initialization error:", err);
  });
