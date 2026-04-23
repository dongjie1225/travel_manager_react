// src/router/index.js
import { createRouter, createWebHistory } from "vue-router";

let base =''

// 定义路由映射表
const routes = [
  // {
  //   path: '/',
  //   name: 'HelloWorld',
  //   component: HelloWorld
  // },
  // 动态路由示例
  {
    path: `${base}/`,
    name: "LoginPage",
    component: () => import("../components/LoginPage.vue"), // 路由懒加载
  },
  {
    path: `${base}/TravelApp`,
    name: "TravelApp",
    component: () => import("../components/TravelApp.vue"), // 路由懒加载
  },
  {
    path: `${base}/TravelManager`,
    name: "TravelManager",
    component: () => import("../components/TravelManager.vue"),
  },
  {
    path: `${base}/SelfTravel`,
    name: "SelfTravel",
    component: () => import("../components/SelfTravel.vue"),
  },
  {
    path: `${base}/ScenicSpot`,
    name: "ScenicSpot",
    component: () => import("../components/ScenicSpot.vue"),
  }
];

// 创建路由实例
const router = createRouter({
  history: createWebHistory(), // 使用 HTML5 History 模式（去除 #）
  routes, // 简写，相当于 routes: routes
});

export default router;
