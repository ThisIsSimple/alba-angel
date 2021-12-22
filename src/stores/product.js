import { makeAutoObservable } from "mobx";

class ProductStore {
  products = []; // 전체 상품 (product)
  searchedProducts = []; // 실제 선택된 상품 (id)
  filteredProducts = []; // 보여지는 상품 (id)

  detailCrawlingCount = 0;

  constructor() {
    makeAutoObservable(this);
  }

  setInitialData(products) {
    this.products = products;
    this.searchedProducts = products;
    this.filteredProducts = products;
  }

  updateProductDetail(product, data) {
    const { category, name, url: storeUrl, count } = data;
    const newProduct = {
      ...product,
      name,
      category,
      url: storeUrl,
      count,
    };
    this.products = this.products.map((p) =>
      p.id === product.id ? newProduct : p
    );
    this.filteredProducts = this.filteredProducts.map((p) =>
      p.id === product.id ? newProduct : p
    );
    this.searchedProducts = this.searchedProducts.map((p) =>
      p.id === product.id ? newProduct : p
    );
  }
}

export const productStore = new ProductStore();
