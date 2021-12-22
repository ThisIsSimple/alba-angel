import { useState } from "react";
import SquareLoader from "react-spinners/SquareLoader";
import axios from "axios";
import xlsx from "xlsx";
import _ from "lodash";
import { observer } from "mobx-react";
import { Offline } from "react-detect-offline";
import { productStore } from "./stores/product";
import { toJS } from "mobx";

function App() {
  // const BASE_URL = "https://smartstore.cordelia273.space";
  const BASE_URL = "http://localhost:9000";

  const [showForm, setShowForm] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [startPage, setStartPage] = useState(1);
  const [endPage, setEndPage] = useState(10);

  const [loading, setLoading] = useState(false);
  const [buttonLoading, setButtonLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");

  const [brands, setBrands] = useState([]);
  const [filteredBrands, setFilteredBrands] = useState([]);

  const [sort, setSort] = useState("review"); // rel, review, review_rel, date

  const [step, setStep] = useState(1);
  const [query, setQuery] = useState("");
  const [showClearQuery, setShowClearQuery] = useState(false);

  const requestBrands = () => {
    if (categoryId === "") {
      alert("카테고리를 입력해주세요");
      return;
    }
    setLoading(true);
    setButtonLoading(true);
    setLoadingText(`[${categoryId}] 카테고리의 브랜드 정보 요청중`);
    axios
      .get(`${BASE_URL}/api/brands/${categoryId}`)
      .then((res) => {
        setBrands(res.data);
        setFilteredBrands(res.data);
        setStep(2);
      })
      .catch((e) => {
        console.error(e);
        alert("오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
      })
      .finally(() => {
        setLoading(false);
        setButtonLoading(false);
      });
  };

  const requestProducts = () => {
    setLoading(true);
    setButtonLoading(true);
    setLoadingText(
      `${filteredBrands.length}개의 필터로 ${
        80 * (endPage - startPage + 1)
      }개 상품 중에서 조건에 맞는 상품을 찾는 중...`
    );
    axios
      .post(`${BASE_URL}/api/products/${categoryId}`, {
        brandString: filteredBrands.join(","),
        startPage,
        endPage,
        sort,
      })
      .then((res) => {
        const uniqueData = _.uniqBy(res.data, "id");
        productStore.setInitialData(uniqueData);
        setShowForm(false);
        setStep(3);
      })
      .catch((e) => {
        console.error(e);
        alert("오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
      })
      .finally(() => {
        setLoading(false);
        setButtonLoading(false);
        setLoadingText("");
      });
  };

  const requestProductsDetail = async () => {
    setLoading(true);
    setButtonLoading(true);

    setLoadingText(
      `${productStore.filteredProducts.length}개 상품의 판매량 조회중`
    );
    const newProducts = [];
    let crawlingCount = 0;
    for (const product of toJS(productStore.filteredProducts)) {
      crawlingCount += 1;
      const { url, category: isDetailChecked } = product;
      // 카테고리가 없다 = 아직 세부 페이지 조회를 안했다.
      if (!isDetailChecked) {
        try {
          productStore.detailCrawlingCount = crawlingCount;
          const res = await axios.post(
            `${BASE_URL}/api/productDetail`,
            {
              url,
            },
            { headers: { "Content-Type": "application/json" } }
          );
          const { category, name, url: storeUrl, count } = res.data;
          productStore.updateProductDetail(product, res.data);
          newProducts.push({
            ...product,
            name,
            category,
            url: storeUrl,
            count,
          });
        } catch (e) {
          console.error(e);
          newProducts.push(product);
        }
      } else {
        newProducts.push(product);
      }
    }
    productStore.detailCrawlingCount = 0;

    setButtonLoading(false);
    setLoading(false);
    setLoadingText("");

    setStep(4);
    setQuery("");
  };

  const filterZeroPurchase = () => {
    productStore.filteredProducts = productStore.products.filter((p) => {
      const { count } = p;
      return count === undefined || count !== 0;
    });
  };

  const searchProducts = (e, reset = false) => {
    e.preventDefault();

    if (reset) productStore.searchedProducts = productStore.products;
    else
      productStore.searchedProducts = productStore.products.filter(({ name }) =>
        name.toLowerCase().includes(query.toLowerCase())
      );
  };

  const requestExcelExport = () => {
    setLoading(true);
    // 상품 유효성 검증 및 엑셀에 필요한 형태로 데이터 가공
    const data = [];
    for (const fp of productStore.filteredProducts) {
      const { category, name, shop, date, url, count } = fp;
      if (!category) {
        alert(
          "선택한 상품 중에 상품 판매량이 집계되지 않은 상품이 있습니다. '상품 판매량 정보 요청'을 다시 시도해 주시기 바랍니다."
        );
        setLoading(false);
        return;
      }
      data.push([category, name, shop, date, url, count]);
    }
    // 엑셀 파일로 변환
    const header = [
      "카테고리",
      "제품명",
      "상점",
      "등록일자",
      "URL",
      "구매건수",
    ];
    const book = xlsx.utils.book_new();

    const sheet = xlsx.utils.aoa_to_sheet([header, ...data]);
    sheet["!cols"] = [
      { wpx: 200 },
      { wpx: 200 },
      { wpx: 100 },
      { wpx: 100 },
      { wpx: 300 },
      { wpx: 100 },
    ];
    // 하이퍼링크 적용
    for (let i = 0; i < data.length; i++) {
      try {
        sheet[
          xlsx.utils.encode_cell({
            c: 4,
            r: i + 1,
          })
        ].l = { Target: data[i][4], Tooltip: data[i][1] };
      } catch (e) {
        console.log(e);
      }
    }
    xlsx.utils.book_append_sheet(book, sheet);
    xlsx.writeFile(book, `files/${Date.now()}.xlsx`);
    setLoading(false);
  };

  return (
    <>
      {loading && (
        <div className="fixed w-screen h-screen bg-opacity-70 bg-black flex flex-col justify-center items-center z-50">
          <div className="mb-2">
            <SquareLoader color="#3c82f6" />
          </div>
          <p className="text-white">{loadingText}</p>
          {!!productStore.detailCrawlingCount && (
            <p className="text-white">
              ({productStore.detailCrawlingCount}/
              {productStore.filteredProducts.length})
            </p>
          )}
        </div>
      )}
      <nav className="fixed top-0 left-0 w-screen z-40 shadow">
        <Offline>
          <div className="bg-red-500 px-3 py-1 text-white">
            오프라인입니다. 인터넷을 연결해주세요.
          </div>
        </Offline>
        <div className="bg-blue-500 p-3">
          <h1 className="font-bold text-xl text-white">
            지은이의 행복한 알바생활
          </h1>
        </div>
      </nav>
      <div className="h-12" />
      {step >= 3 && (
        <>
          <div
            className="fixed p-3 w-screen flex justify-between bg-pink-100 cursor-pointer z-40 mb-4 shadow"
            style={{ top: 52 }}
            onClick={() => setShowForm(!showForm)}
          >
            <div>
              <span className="mr-3">
                <span className="bg-pink-500 text-white text-sm px-2 py-0.5 rounded mr-2">
                  카테고리
                </span>
                {categoryId}
              </span>
              <span className="mr-3">
                <span className="bg-pink-500 text-white text-sm px-2 py-0.5 rounded mr-2">
                  페이지
                </span>
                {startPage} ~ {endPage}
              </span>
              <span className="mr-3">
                <span className="bg-pink-500 text-white text-sm px-2 py-0.5 rounded mr-2">
                  브랜드
                </span>
                {filteredBrands.length}/{brands.length}개
              </span>
              <span className="mr-3">
                <span className="bg-pink-500 text-white text-sm px-2 py-0.5 rounded mr-2">
                  선택된 상품
                </span>
                {productStore.filteredProducts.length}/
                {productStore.products.length}개
              </span>
            </div>
            <div>
              {showForm ? (
                <i aria-hidden class="fas fa-chevron-up" />
              ) : (
                <i aria-hidden class="fas fa-chevron-down" />
              )}
            </div>
          </div>
          <div className="h-12" />
        </>
      )}
      <div className="p-3">
        <div
          className={`transition-all duration-300 overflow-scroll mb-4 ${
            !(step < 3 || showForm) && "max-h-0"
          }`}
          style={step < 3 || showForm ? { maxHeight: 3000 } : {}}
        >
          <section className="grid md:grid-cols-2 mb-4">
            <div className="mb-4">
              <header className="mb-3">
                <h2 className="font-bold">카테고리 입력</h2>
              </header>
              <div className="flex items-center mb-2">
                <input
                  type="text"
                  className="px-3 py-1 border rounded-md mr-3"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.currentTarget.value)}
                  placeholder="카테고리 ID 입력"
                />
                <button
                  className="bg-violet-600 text-white rounded-md px-3 py-0.5 mr-3"
                  onClick={requestBrands}
                  disabled={buttonLoading}
                >
                  브랜드 정보 요청
                </button>
              </div>
            </div>
            {step >= 2 && (
              <div className="mb-4">
                <header className="mb-3">
                  <h2 className="font-bold">페이지 입력</h2>
                </header>
                <div className="flex items-center mb-3">
                  <input
                    className="px-3 py-1 border rounded-md mr-3 w-24"
                    type="number"
                    min={1}
                    value={startPage}
                    onChange={(e) => setStartPage(e.currentTarget.value)}
                  />
                  <input
                    className="px-3 py-1 border rounded-md mr-3 w-24"
                    type="number"
                    min={1}
                    value={endPage}
                    onChange={(e) => setEndPage(e.currentTarget.value)}
                  />
                  <button
                    className="bg-violet-600 text-white rounded-md px-3 py-0.5 mr-3"
                    onClick={requestProducts}
                    disabled={buttonLoading}
                  >
                    상품 조회
                  </button>
                </div>
                <div className="flex flex-wrap">
                  <button
                    className="bg-green-500 text-white rounded-md px-2 py-0.5 mr-3 flex items-center my-1"
                    onClick={() => setSort("rel")}
                  >
                    <div
                      className={`${
                        sort === "rel" ? "bg-green-500" : "bg-white"
                      } w-4 h-4 border-2 border-white rounded mr-2`}
                    />
                    네이버 랭킹순
                  </button>
                  <button
                    className="bg-green-500 text-white rounded-md px-2 py-0.5 mr-3 flex items-center my-1"
                    onClick={() => setSort("date")}
                  >
                    <div
                      className={`${
                        sort === "date" ? "bg-green-500" : "bg-white"
                      } w-4 h-4 border-2 border-white rounded mr-2`}
                    />
                    등록일순
                  </button>
                  <button
                    className="bg-green-500 text-white rounded-md px-2 py-0.5 mr-3 flex items-center my-1"
                    onClick={() => setSort("review")}
                  >
                    <div
                      className={`${
                        sort === "review" ? "bg-green-500" : "bg-white"
                      } w-4 h-4 border-2 border-white rounded mr-2`}
                    />
                    리뷰 많은 순
                  </button>
                  <button
                    className="bg-green-500 text-white rounded-md px-2 py-0.5 mr-3 flex items-center my-1"
                    onClick={() => setSort("review_rel")}
                  >
                    <div
                      className={`${
                        sort === "review_rel" ? "bg-green-500" : "bg-white"
                      } w-4 h-4 border-2 border-white rounded mr-2`}
                    />
                    리뷰 좋은 순
                  </button>
                </div>
              </div>
            )}
          </section>
          <section className="mb-4">
            <header className="flex items-center mb-3">
              <h2 className="font-bold mr-3">
                브랜드 필터 선택 ({brands.length})
              </h2>
              {brands.length > 0 && (
                <>
                  <button
                    className="bg-blue-500 text-white rounded text-sm px-2 py-0.5 mr-2"
                    onClick={() => setFilteredBrands(brands)}
                  >
                    전체 선택
                  </button>
                  <button
                    className="bg-blue-500 text-white rounded text-sm px-2 py-0.5 mr-2"
                    onClick={() => setFilteredBrands([])}
                  >
                    전체 해제
                  </button>
                </>
              )}
            </header>
            {brands.length > 0 ? (
              <div className="flex flex-wrap relative">
                {brands.map((brand) => {
                  const active = filteredBrands.find((fb) => fb === brand);
                  return (
                    <div
                      key={brand}
                      className="px-2 py-0.5 text-sm bg-gray-300 text-gray-900 rounded-md cursor-pointer flex items-center m-1"
                      onClick={() => {
                        if (active) {
                          setFilteredBrands(
                            filteredBrands.filter((fb) => brand !== fb)
                          );
                        } else {
                          setFilteredBrands([...filteredBrands, brand]);
                        }
                      }}
                    >
                      <div
                        className={`${
                          active ? "bg-blue-600" : "bg-white"
                        } rounded-sm border-2 border-white w-3 h-3 mr-2`}
                      />
                      {brand}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex justify-center items-center text-gray-500 py-10">
                브랜드 정보가 없습니다.
              </div>
            )}
          </section>
        </div>
        <section className="mb-4">
          <header className="flex justify-between items-start mb-3">
            <h2 className="font-bold">
              상품 목록 ({productStore.products.length})
            </h2>
          </header>
          {productStore.searchedProducts.length > 0 ? (
            toJS(productStore.searchedProducts).map((product) => {
              const {
                id,
                name,
                url,
                image,
                shop,
                date,
                page,
                category,
                count,
              } = product;
              const active = productStore.filteredProducts.some(
                (fp) => fp.id === id
              );
              return (
                <div
                  key={id}
                  className="flex flex-nowrap items-center bg-gray-200 rounded-lg p-3 mb-3 cursor-pointer"
                  onClick={() => {
                    if (active) {
                      productStore.filteredProducts =
                        productStore.filteredProducts.filter(
                          (fp) => fp.id !== id
                        );
                    } else {
                      productStore.filteredProducts = _.union(
                        productStore.filteredProducts,
                        [product]
                      );
                    }
                  }}
                >
                  <div
                    className={`flex items-center ${!active && "opacity-30"}`}
                  >
                    <div
                      className={`${
                        active ? "bg-blue-500" : "bg-white"
                      } flex-shrink-0 w-6 h-6 border-4 rounded border-white mr-2`}
                    />
                    {image && (
                      <img
                        src={image}
                        alt={name}
                        className={`w-36 h-36 object-fill rounded-lg shrink-0 mr-3 ${
                          !active && "opacity-30"
                        }`}
                      />
                    )}
                    <div className="flex-shrink">
                      <span className="bg-orange-300 px-1 py-0.5 rounded mr-2">
                        {id}
                      </span>
                      <h3 className="font-bold mb-2">
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="mr-3">{name}</span>
                          <i
                            aria-hidden
                            class="fas text-gray-600 fa-external-link-alt"
                          />
                        </a>
                      </h3>
                      <p className="text-sm mb-2">
                        <span className="bg-orange-300 px-1 py-0.5 rounded mr-2">
                          페이지
                        </span>
                        <span className="mr-4">{page}</span>
                        <span className="bg-orange-300 px-1 py-0.5 rounded mr-2">
                          상점명
                        </span>
                        <span className="mr-4">{shop}</span>
                        <span className="bg-orange-300 px-1 py-0.5 rounded mr-2">
                          등록일
                        </span>
                        <span className="mr-2">{date}</span>
                      </p>
                      {category && (
                        <p className="text-sm">
                          <span className="bg-orange-300 px-1 py-0.5 rounded mr-2">
                            카테고리
                          </span>
                          <span className="mr-4">{category}</span>
                          <span className="bg-orange-300 px-1 py-0.5 rounded mr-2">
                            누적 구매량
                          </span>
                          <span className="mr-2">{count}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex justify-center items-center text-gray-500 py-10">
              검색된 상품이 없습니다.
            </div>
          )}
        </section>
      </div>
      <div className="h-16" />
      <footer className="fixed bottom-0 left-0 w-screen p-3 bg-white shadow border-t border-gray-400">
        <div className="flex justify-between items-center flex-wrap">
          <div className="flex items-center">
            <form onSubmit={searchProducts} className="flex items-center mr-3">
              <div className="relative">
                <input
                  type="text"
                  className="border rounded-md px-3 py-1 mr-2"
                  value={query}
                  onChange={(e) => setQuery(e.currentTarget.value)}
                  onMouseEnter={() => setShowClearQuery(true)}
                  onMouseLeave={() => setShowClearQuery(false)}
                  placeholder="검색어를 입력해주세요."
                />
                {showClearQuery && (
                  <div
                    className="absolute right-5 top-1/2 -translate-y-1/2 cursor-pointer text-gray-600"
                    onClick={(e) => {
                      setQuery("");
                      searchProducts(e, true);
                    }}
                    onMouseEnter={() => setShowClearQuery(true)}
                    onMouseLeave={() => setShowClearQuery(false)}
                  >
                    <i aria-hidden class="far fa-times-circle" />
                  </div>
                )}
              </div>
              <button
                type="submit"
                className="bg-orange-500 border border-orange-500 text-white rounded-md px-3 py-1"
                disabled={buttonLoading}
              >
                검색
              </button>
            </form>
            {productStore.products.length > 0 && (
              <>
                <button
                  className="bg-blue-500 text-white rounded text-sm px-2 py-0.5 mr-2"
                  onClick={() =>
                    (productStore.filteredProducts = _.union(
                      productStore.filteredProducts,
                      productStore.searchedProducts
                    ))
                  }
                >
                  전체 선택
                </button>
                <button
                  className="bg-blue-500 text-white rounded text-sm px-2 py-0.5 mr-2"
                  onClick={() =>
                    (productStore.filteredProducts = _.reject(
                      productStore.filteredProducts,
                      (item) =>
                        _.find(productStore.searchedProducts, { id: item.id })
                    ))
                  }
                >
                  전체 해제
                </button>
              </>
            )}
            {step === 4 && (
              <>
                <button
                  className="bg-pink-500 text-white text-sm rounded-md px-2 py-0.5"
                  onClick={filterZeroPurchase}
                  disabled={buttonLoading}
                >
                  판매량 0인 상품 제외
                </button>
              </>
            )}
          </div>
          <div className="flex items-center">
            <button
              className="bg-gray-300 text-gray-800 rounded-md px-2 py-0.5 mr-3"
              onClick={() => {
                productStore.products = productStore.filteredProducts;
                productStore.searchedProducts = _.reject(
                  productStore.searchedProducts,
                  (item) =>
                    !_.find(productStore.filteredProducts, { id: item.id })
                );
              }}
              disabled={buttonLoading}
            >
              선택 안된 상품 제거
            </button>
            {step >= 3 && (
              <button
                className="bg-violet-600 text-white rounded-md px-2 py-0.5 mr-3"
                onClick={requestProductsDetail}
                disabled={buttonLoading}
              >
                판매량 조회
              </button>
            )}
            {step === 4 && (
              <button
                className="bg-green-600 rounded-md px-2 py-0.5 text-white"
                onClick={requestExcelExport}
                disabled={buttonLoading}
              >
                엑셀 다운로드
              </button>
            )}
          </div>
        </div>
      </footer>
    </>
  );
}

export default observer(App);
